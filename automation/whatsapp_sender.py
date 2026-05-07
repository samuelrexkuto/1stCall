#!/usr/bin/env python3
from typing import Optional, List, Dict, Any
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

PROFILE_DIR = str(Path.cwd() / "automation" / ".whatsapp-profile")
WHATSAPP_WEB_URL = os.environ.get("WHATSAPP_WEB_URL", "https://web.whatsapp.com/")
LOGIN_TIMEOUT = int(os.environ.get("WHATSAPP_LOGIN_TIMEOUT_SECONDS", "90"))
CHAT_TIMEOUT = int(os.environ.get("WHATSAPP_CHAT_TIMEOUT_SECONDS", "15"))
SEND_TIMEOUT = int(os.environ.get("WHATSAPP_SEND_TIMEOUT_SECONDS", "45"))


def normalize_phone(phone: str) -> Optional[str]:
    cleaned = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if not cleaned:
        return None
    digits = cleaned[1:] if cleaned.startswith("+") else cleaned
    if len(digits) < 8 or len(digits) > 15:
        return None
    return f"+{digits}" if cleaned.startswith("+") else digits


def setup_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument(f"--user-data-dir={PROFILE_DIR}")
    options.add_argument(f"--profile-directory={os.environ.get('WHATSAPP_CHROME_PROFILE_NAME', 'Default')}")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    chrome_binary = os.environ.get("WHATSAPP_CHROME_BINARY")
    if chrome_binary:
        options.binary_location = chrome_binary

    if os.environ.get("WHATSAPP_CHROME_HEADLESS", "").lower() in {"1", "true", "yes"}:
        options.add_argument("--headless=new")

    driver = webdriver.Chrome(options=options)

    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"},
        )
    except Exception:
        pass

    return driver


def wait_for_session(driver: webdriver.Chrome) -> None:
    driver.get(WHATSAPP_WEB_URL)

    WebDriverWait(driver, LOGIN_TIMEOUT).until(
        lambda drv: drv.execute_script("return document.readyState") == "complete"
    )

    try:
        WebDriverWait(driver, CHAT_TIMEOUT).until(
            EC.any_of(
                EC.presence_of_element_located((By.XPATH, '//div[contains(text(),"Search or start a new chat")]')),
                EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"]')),
                EC.presence_of_element_located((By.XPATH, '//canvas')),
                EC.presence_of_element_located((By.XPATH, '//div[@id="app"]')),
            )
        )
    except TimeoutException:
        print(
            "[whatsapp_sender] wait_for_session soft check timed out; continuing to open_chat",
            file=sys.stderr,
            flush=True,
        )


def open_chat(driver: webdriver.Chrome, phone: str) -> bool:
    normalized = normalize_phone(phone)
    if not normalized:
        return False

    digits = normalized[1:] if normalized.startswith("+") else normalized
    chat_url = f"{WHATSAPP_WEB_URL}send?phone={quote(digits)}&text&app_absent=0"
    print(f"[whatsapp_sender] open_chat url: {chat_url}", file=sys.stderr, flush=True)
    driver.get(chat_url)

    try:
        WebDriverWait(driver, CHAT_TIMEOUT).until(
            EC.any_of(
                EC.presence_of_element_located((By.XPATH, '//footer//*[@contenteditable="true"]')),
                EC.presence_of_element_located((By.XPATH, '//div[@title="Type a message"]')),
                EC.presence_of_element_located((By.XPATH, '//div[contains(@aria-label,"Message")]')),
                EC.presence_of_element_located((By.XPATH, '//span[@data-icon="send"]')),
            )
        )
        print("[whatsapp_sender] open_chat status: message box ready", file=sys.stderr, flush=True)
        return True
    except TimeoutException:
        page_text = driver.page_source.lower()
        invalid_number = "phone number shared via url is invalid" in page_text or "invalid" in page_text
        not_on_whatsapp = "phone number isn't on whatsapp" in page_text or "not on whatsapp" in page_text
        print(
            f"[whatsapp_sender] open_chat status: invalid_number={invalid_number} not_on_whatsapp={not_on_whatsapp} message_box_ready=False",
            file=sys.stderr,
            flush=True,
        )
        return False


def get_message_box(driver: webdriver.Chrome):
    selectors = [
        (By.XPATH, '//footer//*[@contenteditable="true"]'),
        (By.XPATH, '//div[@title="Type a message"]'),
        (By.XPATH, '//div[contains(@aria-label,"Message")]'),
    ]

    def locate_message_box(drv):
        for by, value in selectors:
            elements = drv.find_elements(by, value)
            for element in elements:
                if element.is_displayed():
                    return element
        return False

    return WebDriverWait(driver, SEND_TIMEOUT).until(locate_message_box)


def send_message(driver: webdriver.Chrome, message: str) -> bool:
    try:
        box = WebDriverWait(driver, SEND_TIMEOUT).until(
            EC.presence_of_element_located((By.XPATH, '//footer//*[@contenteditable="true"]'))
        )
        box.click()

        lines = message.split("\n")
        for index, line in enumerate(lines):
            if index > 0:
                box.send_keys(Keys.SHIFT, Keys.ENTER)
            if line:
                box.send_keys(line)

        box.send_keys(Keys.ENTER)

        WebDriverWait(driver, SEND_TIMEOUT).until(
            EC.any_of(
                EC.presence_of_element_located((By.XPATH, '//span[@data-icon="msg-time"]')),
                EC.presence_of_element_located((By.XPATH, '//span[@data-icon="msg-check"]')),
                EC.presence_of_element_located((By.XPATH, '//span[@data-icon="msg-dblcheck"]')),
            )
        )
        return True
    except (TimeoutException, WebDriverException):
        return False


def fail_result(worker_id: str, phone: str, error: str) -> Dict[str, str]:
    return {
        "workerId": worker_id,
        "phone": phone,
        "error": error,
    }


def sent_result(worker_id: str, phone: str) -> Dict[str, str]:
    return {
        "workerId": worker_id,
        "phone": phone,
    }


def main() -> None:
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")

    recipients = payload.get("recipients", [])
    message = payload.get("message", "")

    if not isinstance(recipients, list):
        recipients = []
    if not isinstance(message, str):
        message = ""

    print(f"[whatsapp_sender] executing script: {Path(__file__).resolve()}", file=sys.stderr, flush=True)

    results: Dict[str, Any] = {"ok": True, "sent": [], "failed": []}
    driver = setup_driver()

    try:
        try:
            wait_for_session(driver)
        except Exception as exc:
            print(
                f"[whatsapp_sender] wait_for_session soft failure: {exc}",
                file=sys.stderr,
                flush=True,
            )
        time.sleep(1.5)

        for recipient in recipients:
            worker_id = str(recipient.get("worker_id") or recipient.get("workerId") or "")
            phone = str(recipient.get("phone") or "")

            normalized_phone = normalize_phone(phone)
            if not worker_id:
                results["failed"].append(fail_result("", phone, "Missing worker_id"))
                continue
            if not normalized_phone:
                results["failed"].append(fail_result(worker_id, phone, "Invalid phone number"))
                continue

            try:
                opened = open_chat(driver, normalized_phone)
                if not opened:
                    results["failed"].append(
                        fail_result(worker_id, normalized_phone, "Failed to open WhatsApp chat"),
                    )
                    continue

                time.sleep(1.0)

                sent = send_message(driver, message)
                if sent:
                    results["sent"].append(sent_result(worker_id, normalized_phone))
                else:
                    results["failed"].append(
                        fail_result(worker_id, normalized_phone, "Failed to send message"),
                    )

                time.sleep(1.0)
            except Exception as exc:
                results["failed"].append(fail_result(worker_id, normalized_phone, str(exc)))

        results["ok"] = len(results["failed"]) == 0
        sys.stdout.write(json.dumps(results))
        sys.stdout.flush()
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
