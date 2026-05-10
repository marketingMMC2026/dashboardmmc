import { NextResponse } from "next/server";
import { getDashboardData } from "@/app/lib/dashboard-data";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json(data);
}
