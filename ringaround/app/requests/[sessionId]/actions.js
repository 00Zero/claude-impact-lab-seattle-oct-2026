"use server";

import { getSession } from "@/auth";
import { canStartCalls, getOwnedSession, sendUserMessage } from "@/lib/agent";
import { MESSAGE_LIMIT } from "./limits";

// Sends the requester's reply or steering note to the agent working on their
// request. Returns { ok } or { error }.
export async function sendMessage(sessionId, text) {
  const user = (await getSession())?.user;
  if (!user?.id) return { error: "Your sign-in expired. Sign in again to message the agent." };
  const userId = user.id;
  // Same gate as starting a request: steering the agent directs real calls.
  if (!canStartCalls(user.email)) return { error: "Calling isn’t available for your account." };
  const message = typeof text === "string" ? text.trim() : "";
  if (!message) return { error: "Type a message first." };
  if (message.length > MESSAGE_LIMIT) return { error: `Keep messages under ${MESSAGE_LIMIT} characters.` };

  // Only the requester can steer their own agent.
  const session = await getOwnedSession(sessionId, userId);
  if (!session) return { error: "This request couldn’t be found." };
  if (session.status === "terminated") return { error: "This request has finished, so the agent can’t take messages." };

  try {
    return await sendUserMessage(session.id, message);
  } catch (error) {
    console.error("Failed to send message", session.id, error);
    return { error: "Your message didn’t go through. Try again in a minute." };
  }
}
