'use strict';

// Receive-only guarantee.
//
// This bridge exists to *read* parent messages into the dashboard inbox. It
// must never send a WhatsApp message to a parent — that is both the core safety
// promise of the incoming loop (a human always sends replies) and the single
// biggest lever for staying off WhatsApp's radar (bans target senders/spam).
//
// Rather than trust that no future edit introduces a send, we neutralise the
// socket's message-sending methods right after it's created: any call throws
// loudly instead of messaging a parent. Receiving, group-metadata reads, and
// low-level delivery receipts are untouched — only user-visible content sends
// are blocked (`sendMessage` is the public send API; `relayMessage` is the
// primitive it calls). When we move to the official WhatsApp API for sending,
// that will be a separate, explicit, approve-before-send path — not this bridge.

const BLOCKED_SEND_METHODS = ['sendMessage', 'relayMessage'];

function guardOutbound(sock) {
  if (!sock) return sock;
  for (const name of BLOCKED_SEND_METHODS) {
    if (typeof sock[name] === 'function') {
      sock[name] = () => {
        throw new Error(
          `First Chord incoming bridge is receive-only: sock.${name}() is blocked. ` +
            'Replies are sent by a human; automated sending must go through the ' +
            'official WhatsApp API, not this bridge.',
        );
      };
    }
  }
  return sock;
}

module.exports = { guardOutbound, BLOCKED_SEND_METHODS };
