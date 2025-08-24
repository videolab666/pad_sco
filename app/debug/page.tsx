"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorLogViewer } from "@/components/error-log-viewer"
import { SupabaseStatus } from "@/components/supabase-status"
import { DatabaseInitializer } from "@/components/database-initializer"
import { isSupabaseAvailable, getSupabaseConnectionInfo } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Импортируем новый компонент
import { DatabaseChecker } from "@/components/database-checker"

export default function DebugPage() {
  const router = useRouter()
  const [testResults, setTestResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const runConnectionTest = async () => {
    setIsLoading(true)
    setTestResults(null)

    try {
      logEvent("info", "Запуск теста соединения с Supabase", "DebugPage")

      // Проверяем доступность Supabase
      const startTime = Date.now()
      const isAvailable = await isSupabaseAvailable()
      const endTime = Date.now()

      // Получаем подробную информацию о соединении
      const connectionInfo = await getSupabaseConnectionInfo()

      // Проверяем переменные окружения
      const envVars = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Установлена" : "Отсутствует",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Установлена" : "Отсутствует",
        // Проверяем другие переменные окружения
        envKeys: Object.keys(process.env).filter(
          (key) => key.includes("SUPABASE") || key.includes("POSTGRES") || key.includes("DATABASE"),
        ),
      }

      const results = {
        timestamp: new Date().toISOString(),
        isAvailable,
        responseTime: endTime - startTime,
        connectionInfo,
        environment: envVars,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
      }

      setTestResults(results)
      logEvent("info", `Тест соединения завершен: ${isAvailable ? "успешно" : "неудачно"}`, "DebugPage", results)
    } catch (error) {
      logEvent("error", "Ошибка при выполнении теста соединения", "DebugPage", error)
      setTestResults({ error: error.message, stack: error.stack })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          На главную
        </Button>
        <SupabaseStatus />
      </div>

      <Tabs defaultValue="database">
        <TabsList className="mb-6">
          <TabsTrigger value="database">База данных</TabsTrigger>
          <TabsTrigger value="connection">Соединение</TabsTrigger>
          <TabsTrigger value="logs">Журнал ошибок</TabsTrigger>
        </TabsList>

        <TabsContent value="database">
          <div className="space-y-6">
            <DatabaseChecker />
            <DatabaseInitializer />
          </div>
        </TabsContent>

        <TabsContent value="connection">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Диагностика соединения с базой данных</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={runConnectionTest} disabled={isLoading}>
                  {isLoading ? "Выполнение теста..." : "Запустить тест соединения"}
                </Button>
              </div>

              {testResults && (
                <div className="border rounded-md p-4 mt-4">
                  <h3 className="font-medium mb-2">Результаты теста:</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60">
                    {JSON.stringify(testResults, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <ErrorLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  )
}
