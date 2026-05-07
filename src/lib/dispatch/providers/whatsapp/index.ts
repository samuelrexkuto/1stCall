import { WhatsAppCloudApiProvider } from "@/lib/dispatch/providers/whatsapp/cloudApi";
import { WhatsAppSeleniumProvider } from "@/lib/dispatch/providers/whatsapp/selenium";
import type {
  WhatsAppDispatchRequest,
  WhatsAppDispatchResult,
  WhatsAppProvider,
  WhatsAppProviderName,
} from "@/lib/dispatch/providers/whatsapp/types";

function getActiveProviderName(): WhatsAppProviderName {
  const configured = process.env.WHATSAPP_PROVIDER?.trim();

  if (configured === "cloud_api") {
    return "cloud_api";
  }

  return "selenium_web";
}

function getProvider(): WhatsAppProvider {
  const providerName = getActiveProviderName();

  if (providerName === "cloud_api") {
    return new WhatsAppCloudApiProvider();
  }

  return new WhatsAppSeleniumProvider();
}

export async function sendWhatsAppDispatch(
  request: WhatsAppDispatchRequest,
): Promise<WhatsAppDispatchResult> {
  const provider = getProvider();
  return provider.sendDispatch(request);
}

export { getActiveProviderName };
export type {
  WhatsAppDispatchRequest,
  WhatsAppDispatchResult,
  WhatsAppRecipient,
  WhatsAppRecipientFailure,
  WhatsAppRecipientSuccess,
  WhatsAppProviderName,
} from "@/lib/dispatch/providers/whatsapp/types";
