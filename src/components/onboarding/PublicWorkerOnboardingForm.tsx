"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEmptyEditableLocation,
  LocationAutocompleteInput,
  type LocationInputState,
} from "@/components/forms/LocationAutocompleteInput";
import { STANDARD_ROLES } from "@/lib/constants/roles";
import { hasValidCoordinates } from "@/lib/location";
import styles from "./PublicWorkerOnboardingForm.module.css";

const INSURANCE_TYPE_OPTIONS = [
  "Public Liability",
  "Employers' Liability",
  "Professional Indemnity",
  "Contractors All Risk",
] as const;

export type PublicOnboardingFormState = {
  worker_type: "tradesman" | "contractor";
  contractor_type: "multi_discipline" | "specialist" | "";
  full_name: string;
  mobile_number: string;
  email: string;
  primary_role: string;
  specialist_area: string;
  skill_tag: string;
  languages_spoken: string;
  location: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_resolved: boolean;
  available_today: boolean;
  right_to_work: boolean;
  whatsapp_opt_in: boolean;
  priority_tier: string;
  insurance_verified: boolean;
  insurance_types: string[];
  enhanced_dbs: boolean;
  first_aid_certified: boolean;
  companies_house_verified: boolean;
  companies_house_number: string;
  constructionline_member: boolean;
  qualification_label: string;
  accreditations: string;
  cscs_card: File | null;
  id_document: File | null;
  portfolio_files: File[];
  certificate_files: File[];
};

const initialState: PublicOnboardingFormState = {
  worker_type: "tradesman",
  contractor_type: "",
  full_name: "",
  mobile_number: "",
  email: "",
  primary_role: "",
  specialist_area: "",
  skill_tag: "",
  languages_spoken: "",
  location: "",
  place_id: null,
  latitude: null,
  longitude: null,
  location_resolved: false,
  available_today: false,
  right_to_work: false,
  whatsapp_opt_in: false,
  priority_tier: "standard",
  insurance_verified: false,
  insurance_types: [],
  enhanced_dbs: false,
  first_aid_certified: false,
  companies_house_verified: false,
  companies_house_number: "",
  constructionline_member: false,
  qualification_label: "",
  accreditations: "",
  cscs_card: null,
  id_document: null,
  portfolio_files: [],
  certificate_files: [],
};

function getFieldClass(hasError: boolean) {
  return `${styles.input} ${hasError ? styles.inputError : ""}`;
}

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function FieldWrapper({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      {children}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

function CheckboxCard({
  label,
  checked,
  onChange,
  required = false,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.checkboxCard}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={styles.checkboxInput}
        />
        <span className={styles.checkboxLabel}>
          {label}
          {required ? <span className={styles.required}> *</span> : null}
        </span>
      </label>
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

function UploadDropzone({
  label,
  required = false,
  error,
  helperText,
  selectedText,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helperText: string;
  selectedText?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.dropzone}>
      <div className={styles.dropzoneLabel}>
        <div className={styles.dropzoneTitle}>
          {label}
          {required ? <span className={styles.required}> *</span> : null}
        </div>
        <p className={styles.dropzoneHelper}>{helperText}</p>
      </div>
      <div className={styles.dropzonePanel}>
        <div className={styles.dropzoneIcon} aria-hidden="true">
          ↑
        </div>
        <div className={styles.dropzonePanelTitle}>Upload a file</div>
        <div className={styles.dropzonePanelText}>Drag and drop files here or browse from your device.</div>
        <div>{children}</div>
      </div>
      {selectedText ? <p className={styles.selectedText}>{selectedText}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export function PublicWorkerOnboardingForm() {
  const router = useRouter();
  const [form, setForm] = useState<PublicOnboardingFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locationState, setLocationState] = useState<LocationInputState>("empty");
  const [submitting, setSubmitting] = useState(false);

  const hasResolvedLocation = useMemo(
    () => Boolean(form.place_id) || hasValidCoordinates(form),
    [form],
  );
  const hasManualLocation = form.location.trim().length > 0;
  const isContractor = form.worker_type === "contractor";
  const showContractorSkillFields = false;

  const submitBlocked =
    submitting ||
    !form.full_name.trim() ||
    !form.mobile_number.trim() ||
    !form.email.trim() ||
    (!isContractor && !form.primary_role.trim()) ||
    (isContractor && !form.contractor_type) ||
    (!isContractor && !form.skill_tag.trim()) ||
    (isContractor && form.contractor_type === "specialist" && !form.specialist_area.trim()) ||
    !form.location.trim() ||
    (!isContractor && !form.cscs_card) ||
    !form.id_document;

  function setFileList(key: "portfolio_files" | "certificate_files", files: FileList | null) {
    setForm((current) => ({ ...current, [key]: files ? Array.from(files) : [] }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!form.full_name.trim()) nextErrors.full_name = "Full name is required.";
    if (!form.mobile_number.trim()) nextErrors.mobile_number = "Mobile is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (!isContractor && !form.primary_role.trim()) nextErrors.primary_role = "Primary role is required.";
    if (!isContractor && !form.skill_tag.trim()) nextErrors.skill_tag = "Skill tag is required.";
    if (isContractor && !form.contractor_type) nextErrors.contractor_type = "Contractor type is required.";
    if (isContractor && form.contractor_type === "specialist" && !form.specialist_area.trim()) {
      nextErrors.specialist_area = "Specialty is required for specialist contractors.";
    }
    if (!form.location.trim()) nextErrors.location = "Location is required.";
    if (!isContractor && !form.cscs_card) nextErrors.cscs_card = "CSCS card upload is required.";
    if (!form.id_document) nextErrors.id_document = "ID upload is required.";
    if (isContractor && form.companies_house_verified && !form.companies_house_number.trim()) {
      nextErrors.companies_house_number = "Companies House number is required when marked verified.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.set("full_name", form.full_name.trim());
      payload.set("mobile_number", form.mobile_number.trim());
      payload.set("email", form.email.trim());
      payload.set("primary_role", isContractor ? "" : form.primary_role.trim());
      payload.set("worker_type", form.worker_type);
      payload.set("contractor_type", form.contractor_type);
      payload.set("specialist_area", isContractor && form.contractor_type === "specialist" ? form.specialist_area.trim() : "");
      payload.set("skill_tag", isContractor ? "" : form.skill_tag.trim());
      payload.set("languages_spoken", JSON.stringify(splitCommaSeparated(form.languages_spoken)));
      payload.set("location", form.location.trim());
      payload.set("place_id", form.place_id ?? "");
      payload.set("latitude", form.latitude != null ? String(form.latitude) : "");
      payload.set("longitude", form.longitude != null ? String(form.longitude) : "");
      payload.set("location_resolved", String(form.location_resolved));
      payload.set("available_today", String(isContractor ? false : form.available_today));
      payload.set("right_to_work", String(form.right_to_work));
      payload.set("whatsapp_opt_in", String(form.whatsapp_opt_in));
      payload.set("priority_tier", isContractor ? "standard" : form.priority_tier);
      payload.set("insurance_verified", String(form.insurance_verified));
      payload.set("insurance_types", JSON.stringify(form.insurance_types));
      payload.set("enhanced_dbs", String(form.enhanced_dbs));
      payload.set("first_aid_certified", String(form.first_aid_certified));
      payload.set("companies_house_verified", String(form.companies_house_verified));
      payload.set("companies_house_number", form.companies_house_number.trim());
      payload.set("constructionline_member", String(form.constructionline_member));
      payload.set("qualification_label", form.qualification_label.trim());
      payload.set("accreditations", JSON.stringify(splitCommaSeparated(form.accreditations)));
      if (form.cscs_card) payload.set("cscs_card", form.cscs_card as File);
      payload.set("id_document", form.id_document as File);

      for (const file of form.portfolio_files) {
        payload.append("portfolio_files", file);
      }

      for (const file of form.certificate_files) {
        payload.append("certificate_files", file);
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        body: payload,
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "Unable to submit onboarding.");
      }

      setForm(initialState);
      setErrors({});
      setLocationState("empty");
      router.push("/onboarding/success");
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Unable to submit onboarding.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errors.form ? (
        <div className={styles.formError}>
          {errors.form}
        </div>
      ) : null}

      <div className={styles.checklist}>
        <div className={styles.checklistHeader}>
          <div className={styles.checklistHeaderRow}>
            <div>
              <p className={styles.eyebrow}>
                Public application
              </p>
              <h2 className={styles.checklistTitle}>Application checklist</h2>
            </div>
            <div className={`${styles.statusPill} ${hasResolvedLocation && form.location_resolved ? "" : styles.statusPillPending}`}>
              {hasResolvedLocation && form.location_resolved
                ? "Location ready"
                : hasManualLocation
                  ? "Manual location entered"
                  : "Location required"}
            </div>
          </div>
        </div>
        <div className={styles.checklistBody}>
          <div>
            <p className={styles.checklistText}>
              Submit your core details, confirm your location, and upload the required documents.
              Optional portfolio and certificate uploads can be added at the end.
            </p>
          </div>
          <div className={styles.checklistStats}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Registration path</div>
              <div className={styles.statValue}>
                {isContractor ? "Contractor company / compliance profile" : "Tradesman profile with CSCS and ID"}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Location status</div>
              <div className={styles.statValue}>
                {hasResolvedLocation && form.location_resolved
                  ? "Confirmed and ready to submit"
                  : hasManualLocation
                    ? "Manual address will be reviewed"
                    : "Enter your full address or postcode"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormSection
        title="Basic details"
        description="Add the core details we need to review your tradesman or contractor application for the workforce pool."
      >
        <div className={styles.gridTwo}>
          <FieldWrapper label="Registering As" required>
            <select
              value={form.worker_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  worker_type: event.target.value as "tradesman" | "contractor",
                  contractor_type: event.target.value === "contractor" ? current.contractor_type : "",
                  specialist_area: event.target.value === "contractor" ? current.specialist_area : "",
                  primary_role: event.target.value === "contractor" ? "" : current.primary_role,
                  available_today: event.target.value === "contractor" ? false : current.available_today,
                  right_to_work: event.target.value === "contractor" ? false : current.right_to_work,
                  priority_tier: event.target.value === "contractor" ? "standard" : current.priority_tier,
                }))
              }
              className={styles.select}
            >
              <option value="tradesman">Tradesman</option>
              <option value="contractor">Contractor</option>
            </select>
          </FieldWrapper>

          <FieldWrapper label={isContractor ? "Name" : "Full Name"} required error={errors.full_name}>
            <input
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              className={getFieldClass(Boolean(errors.full_name))}
              placeholder={isContractor ? "Enter company or contractor name" : "Enter your full name"}
            />
          </FieldWrapper>

          <FieldWrapper label="Mobile" required error={errors.mobile_number}>
            <input
              type="tel"
              value={form.mobile_number}
              onChange={(event) => setForm((current) => ({ ...current, mobile_number: event.target.value }))}
              className={getFieldClass(Boolean(errors.mobile_number))}
              placeholder="Enter your mobile number"
            />
          </FieldWrapper>

          <FieldWrapper label="Email" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className={getFieldClass(Boolean(errors.email))}
              placeholder="Enter your email address"
            />
          </FieldWrapper>

          {!isContractor ? (
            <FieldWrapper label="Primary Role" required error={errors.primary_role}>
              <select
                value={form.primary_role}
                onChange={(event) => setForm((current) => ({ ...current, primary_role: event.target.value }))}
                className={`${styles.select} ${Boolean(errors.primary_role) ? styles.inputError : ""}`}
              >
                <option value="">Select role</option>
                {STANDARD_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FieldWrapper>
          ) : null}

          {isContractor ? (
            <FieldWrapper label="Contractor Type" required error={errors.contractor_type}>
              <select
                value={form.contractor_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contractor_type: event.target.value as "multi_discipline" | "specialist" | "",
                    specialist_area: "",
                    skill_tag: "",
                  }))
                }
                className={styles.select}
              >
                <option value="">Select contractor type</option>
                <option value="multi_discipline">Multi-Discipline</option>
                <option value="specialist">Specialist</option>
              </select>
            </FieldWrapper>
          ) : null}

          {isContractor && form.contractor_type === "specialist" ? (
            <FieldWrapper label="Specialty" required error={errors.specialist_area}>
              <input
                value={form.specialist_area}
                onChange={(event) => setForm((current) => ({ ...current, specialist_area: event.target.value }))}
                className={getFieldClass(Boolean(errors.specialist_area))}
                placeholder="e.g. M&E, Joinery, Flooring"
              />
            </FieldWrapper>
          ) : null}

          {!isContractor || showContractorSkillFields ? (
            <FieldWrapper label="Skill Tag" required error={errors.skill_tag}>
              <input
                value={form.skill_tag}
                onChange={(event) => setForm((current) => ({ ...current, skill_tag: event.target.value }))}
                className={getFieldClass(Boolean(errors.skill_tag))}
                placeholder="e.g. Skilled Labourer, Joinery"
              />
            </FieldWrapper>
          ) : null}

          <FieldWrapper label="Languages Spoken">
            <input
              value={form.languages_spoken}
              onChange={(event) => setForm((current) => ({ ...current, languages_spoken: event.target.value }))}
              className={styles.input}
              placeholder="English, Polish, Romanian"
            />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection
        title="Work eligibility and preferences"
        description="Tell us where you are based and how we can contact you if your application is approved for future dispatch opportunities."
      >
        <div className={styles.stack}>
          <LocationAutocompleteInput
            label="Location *"
            value={form.location}
            location={{
              ...createEmptyEditableLocation(form.location),
              place_id: form.place_id ?? "",
              latitude: form.latitude,
              longitude: form.longitude,
            }}
            onInputChange={(value) => {
              setForm((current) => ({
                ...current,
                location: value,
                place_id: null,
                latitude: null,
                longitude: null,
                location_resolved: false,
              }));
              setLocationState(value.trim() ? "typing" : "empty");
            }}
            onLocationSelect={(next) => {
              setForm((current) => ({
                ...current,
                location: next.location_display || next.formatted_address || next.location_text,
                place_id: next.place_id || null,
                latitude: next.latitude,
                longitude: next.longitude,
                location_resolved: true,
              }));
              setLocationState("resolved");
            }}
            error={errors.location}
            helperText="Search and select a valid place. If suggestions are offline, enter the best full address you can."
            state={locationState}
          />

          {hasResolvedLocation && form.location_resolved ? (
            <div className={styles.locationConfirmed}>
              <div className={styles.locationConfirmedTitle}>Location confirmed</div>
              <div>
                Coordinates captured: {form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}
              </div>
            </div>
          ) : null}

          <div className={styles.gridChecks}>
            {!isContractor ? (
              <CheckboxCard
                label="WhatsApp Opt-In"
                checked={form.whatsapp_opt_in}
                onChange={(checked) => setForm((current) => ({ ...current, whatsapp_opt_in: checked }))}
              />
            ) : (
              <CheckboxCard
                label="WhatsApp Opt-In"
                checked={form.whatsapp_opt_in}
                onChange={(checked) => setForm((current) => ({ ...current, whatsapp_opt_in: checked }))}
              />
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Credentials and compliance"
        description="Add the procurement-facing details that appear on contractor and tradesman profiles."
      >
        <div className={styles.stack}>
          <div className={styles.gridChecks}>
            <CheckboxCard
              label="Insurance"
              checked={form.insurance_verified}
              onChange={(checked) => setForm((current) => ({ ...current, insurance_verified: checked }))}
            />
            <CheckboxCard
              label="Enhanced DBS"
              checked={form.enhanced_dbs}
              onChange={(checked) => setForm((current) => ({ ...current, enhanced_dbs: checked }))}
            />
            <CheckboxCard
              label="First Aid Certified"
              checked={form.first_aid_certified}
              onChange={(checked) => setForm((current) => ({ ...current, first_aid_certified: checked }))}
            />
            <CheckboxCard
              label="Constructionline Member"
              checked={form.constructionline_member}
              onChange={(checked) => setForm((current) => ({ ...current, constructionline_member: checked }))}
            />
            {isContractor ? (
              <CheckboxCard
                label="Companies House Listed"
                checked={form.companies_house_verified}
                onChange={(checked) => setForm((current) => ({ ...current, companies_house_verified: checked }))}
              />
            ) : null}
          </div>

          <FieldWrapper label="Insurance Types">
            <div className={styles.gridChecks}>
              {INSURANCE_TYPE_OPTIONS.map((option) => (
                <CheckboxCard
                  key={option}
                  label={option}
                  checked={form.insurance_types.includes(option)}
                  onChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      insurance_types: checked
                        ? [...current.insurance_types, option]
                        : current.insurance_types.filter((item) => item !== option),
                    }))
                  }
                />
              ))}
            </div>
          </FieldWrapper>

          <div className={styles.gridTwo}>
            {isContractor ? (
              <FieldWrapper label="Companies House Number" error={errors.companies_house_number}>
                <input
                  value={form.companies_house_number}
                  onChange={(event) => setForm((current) => ({ ...current, companies_house_number: event.target.value }))}
                  className={getFieldClass(Boolean(errors.companies_house_number))}
                  placeholder="e.g. 12345678"
                />
              </FieldWrapper>
            ) : null}

            <FieldWrapper label="Qualification / NVQ Label">
              <input
                value={form.qualification_label}
                onChange={(event) => setForm((current) => ({ ...current, qualification_label: event.target.value }))}
                className={styles.input}
                placeholder="e.g. NVQ Level 2 Carpentry"
              />
            </FieldWrapper>

            <FieldWrapper label="Accreditations / Memberships">
              <input
                value={form.accreditations}
                onChange={(event) => setForm((current) => ({ ...current, accreditations: event.target.value }))}
                className={styles.input}
                placeholder="Constructionline, CHAS, SMAS"
              />
            </FieldWrapper>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Required documents"
        description="Upload the required onboarding documents below so our internal team can review your application for the managed workforce pool."
      >
        <div className={styles.dropzoneGrid}>
          {!isContractor ? (
            <UploadDropzone
              label="CSCS Card Upload"
              required
              error={errors.cscs_card}
              helperText="Drag and drop files here or browse from your device."
              selectedText={form.cscs_card ? form.cscs_card.name : null}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
                onChange={(event) => setForm((current) => ({ ...current, cscs_card: event.target.files?.[0] ?? null }))}
                className={styles.uploadInput}
              />
            </UploadDropzone>
          ) : (
            <UploadDropzone
              label="Insurance / Company Evidence"
              helperText="Upload insurance schedules, Companies House evidence, or related contractor documents."
              selectedText={form.certificate_files.length > 0 ? `${form.certificate_files.length} file(s) selected` : null}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
                onChange={(event) => setFileList("certificate_files", event.target.files)}
                className={styles.uploadInput}
              />
            </UploadDropzone>
          )}

          <UploadDropzone
            label="ID Upload"
            required
            error={errors.id_document}
            helperText="Drag and drop files here or browse from your device."
            selectedText={form.id_document ? form.id_document.name : null}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
              onChange={(event) => setForm((current) => ({ ...current, id_document: event.target.files?.[0] ?? null }))}
              className={styles.uploadInput}
            />
          </UploadDropzone>
        </div>
      </FormSection>

      <FormSection
        title="Additional documents"
        description="Portfolio images and supporting certificates are optional, but they help us assess your profile faster."
      >
        <div className={styles.dropzoneGrid}>
          <UploadDropzone
            label="Portfolio Images"
            helperText="Drag and drop files here or browse from your device."
            selectedText={form.portfolio_files.length > 0 ? `${form.portfolio_files.length} file(s) selected` : null}
          >
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
              onChange={(event) => setFileList("portfolio_files", event.target.files)}
              className={styles.uploadInput}
            />
          </UploadDropzone>

          {!isContractor ? (
            <UploadDropzone
              label="Accreditation Certificates"
              helperText="Drag and drop files here or browse from your device."
              selectedText={form.certificate_files.length > 0 ? `${form.certificate_files.length} file(s) selected` : null}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx"
                onChange={(event) => setFileList("certificate_files", event.target.files)}
                className={styles.uploadInput}
              />
            </UploadDropzone>
          ) : null}
        </div>
      </FormSection>

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={submitBlocked}
          className={styles.submitButton}
        >
          {submitting ? "Submitting..." : "Submit onboarding"}
        </button>
      </div>
    </form>
  );
}
