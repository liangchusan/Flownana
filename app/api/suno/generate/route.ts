import { NextResponse } from "next/server";
import {
  SUNO_RETIREMENT_BODY,
  SUNO_RETIREMENT_STATUS,
} from "@/lib/model-retirement";

export async function POST() {
  return NextResponse.json(SUNO_RETIREMENT_BODY, {
    status: SUNO_RETIREMENT_STATUS,
  });
}
