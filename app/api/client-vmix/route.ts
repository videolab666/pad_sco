import { type NextRequest, NextResponse } from "next/server"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest) {
  try {
    // Этот API-роут предназначен для клиентской стороны
    // Он просто возвращает инструкции по использованию API

    return NextResponse.json({
      message:
        "Этот API-роут предназначен для клиентской стороны. Используйте /api/vmix/[id] для получения данных матча.",
      example: "/api/vmix/your-match-id",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logEvent("error", "Client vMix API: ошибка при обработке запроса", "client-vmix-api", error)
    return NextResponse.json(
      {
        error: "Внутренняя ошибка сервера",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
