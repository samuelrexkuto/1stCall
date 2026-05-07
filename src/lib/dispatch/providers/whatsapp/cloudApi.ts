import type {
  WhatsAppDispatchRequest,
  WhatsAppDispatchResult,
  WhatsAppProvider,
} from "@/lib/dispatch/providers/whatsapp/types";

export class WhatsAppCloudApiProvider implements WhatsAppProvider {
  async sendDispatch(request: WhatsAppDispatchRequest): Promise<WhatsAppDispatchResult> {
    throw new Error(
      `WhatsApp Cloud API provider is not implemented for dispatch ${request.dispatchId}.`,
    );
  }
}
