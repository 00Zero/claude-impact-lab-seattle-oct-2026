import { isIntakeToken } from "@/lib/intake-links";
import { INTAKE_PHOTO_MAX_BYTES } from "@/lib/intake-photo-rules";
import { addIntakePhoto } from "@/lib/intake-photos";

// Photo uploads use a Route Handler rather than a Server Action so the
// browser can report upload progress. The proxy skips this path because it
// would otherwise buffer (and cap) the request body.

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
// Room for multipart overhead and the other form fields.
const MAX_REQUEST_BYTES = INTAKE_PHOTO_MAX_BYTES + 64 * 1024;

export async function POST(
  request: Request,
  ctx: RouteContext<"/i/[token]/photos">,
) {
  // The same CSRF check Next.js applies to Server Actions, plus a custom
  // header that cross-site forms can't send without a CORS preflight.
  if (!isSameOrigin(request) || request.headers.get("x-intake-upload") !== "1") {
    return Response.json({ error: "Request not allowed." }, { status: 403 });
  }

  const { token } = await ctx.params;
  if (!isIntakeToken(token)) {
    return Response.json({ error: "This link isn't valid." }, { status: 404 });
  }

  const length = Number(request.headers.get("content-length"));
  if (length > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Choose a photo smaller than 10 MB." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Upload failed. Please try again." }, { status: 400 });
  }

  const photo = form.get("photo");
  const replaces = form.get("replaces");
  if (
    !(photo instanceof File) ||
    (replaces !== null && !(typeof replaces === "string" && UUID_PATTERN.test(replaces)))
  ) {
    return Response.json({ error: "Upload failed. Please try again." }, { status: 400 });
  }

  const result = await addIntakePhoto(token, photo, {
    replacesPhotoId: replaces,
  });
  return result.ok
    ? Response.json({ photo: result.photo })
    : Response.json({ error: result.error }, { status: 422 });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
