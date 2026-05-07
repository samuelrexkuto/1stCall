export type WhatsAppProviderName = "selenium_web" | "cloud_api";

export interface WhatsAppRecipient {
  workerId: string;
  name: string;
  phone: string;
}

export interface WhatsAppDispatchRequest {
  dispatchId: string;
  jobId: string;
  recipients: WhatsAppRecipient[];
  message: string;
}

export interface WhatsAppRecipientSuccess {
  workerId: string;
  name: string;
  phone: string;
}

export interface WhatsAppRecipientFailure extends WhatsAppRecipientSuccess {
  reason: string;
}

export interface WhatsAppDispatchResult {
  ok: boolean;
  provider: WhatsAppProviderName;
  dispatchId: string;
  sent: WhatsAppRecipientSuccess[];
  failed: WhatsAppRecipientFailure[];
}

export interface WhatsAppProvider {
  sendDispatch(request: WhatsAppDispatchRequest): Promise<WhatsAppDispatchResult>;
}
