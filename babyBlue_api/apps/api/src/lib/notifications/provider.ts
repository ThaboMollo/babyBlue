// Notification delivery providers (restructure Seam 3). The interface is the
// swap point between SMS today and WhatsApp tomorrow: nothing above this line
// knows which channel actually carried the message.
//
// Only the LogProvider is wired now — real SMS/WhatsApp delivery needs a
// provider account + (for WhatsApp) template approval, and lives behind env
// config. `getProvider` is where that selection will happen.

import type { NotificationChannel } from "@babyblue/core";
import { randomUUID } from "node:crypto";

export interface OutboundMessage {
  to: string;
  body: string;
  channel: NotificationChannel;
}

export interface SendResult {
  providerId: string | null;
  status: "sent" | "failed";
}

export interface NotificationProvider {
  readonly name: string;
  send(msg: OutboundMessage): Promise<SendResult>;
}

/**
 * The stub provider: records the message to the log and reports success. Lets
 * the whole dispatch path run end-to-end without a real SMS/WhatsApp account.
 */
export class LogProvider implements NotificationProvider {
  readonly name = "log";
  async send(msg: OutboundMessage): Promise<SendResult> {
    console.log(`[notify:${msg.channel}] → ${msg.to}: ${msg.body}`);
    return { providerId: `log-${randomUUID()}`, status: "sent" };
  }
}

const logProvider = new LogProvider();

/**
 * Resolve the provider for a channel. For now every channel maps to the log
 * stub; a real deployment selects BulkSMS/Clickatell (SMS) or Meta/360dialog
 * (WhatsApp) from env here, keeping call sites channel-agnostic.
 */
export function getProvider(_channel: NotificationChannel): NotificationProvider {
  return logProvider;
}
