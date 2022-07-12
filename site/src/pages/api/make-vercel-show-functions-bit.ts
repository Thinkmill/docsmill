// Vercel doesn't seem to let you see logs from functions unless you have an api route 🙃

import { NextApiRequest, NextApiResponse } from "next";

export default function apiRoute(_req: NextApiRequest, res: NextApiResponse) {
  res.send("ok");
}
