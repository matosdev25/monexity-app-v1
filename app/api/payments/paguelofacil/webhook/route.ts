import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "El checkout normal se confirma mediante la URL de retorno." },
    { status: 405 }
  );
}
