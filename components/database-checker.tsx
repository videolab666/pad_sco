"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Database, AlertCircle, CheckCircle } from "lucide-react"
import { checkTablesExist, checkTablesContent } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"

export function DatabaseChecker() {
  const [tablesStatus, setTablesStatus] = useState(null)
  const [tablesContent, setTablesContent] = useState(null)
  const [isChecking, setIsChecking] = useState(true)

  const checkDatabase = async () => {
    setIsChecking(true)
    try {
      // Проверяем существование таблиц
      const status = await checkTablesExist()
      setTablesStatus(status)
      logEvent("info", "Проверка существования таблиц", "DatabaseChecker", status)

      // Если таблицы существуют, проверяем их содержимое
      if (status.exists) {
        const content = await checkTablesContent()
        setTablesContent(content)
        logEvent("info", "Проверка содержимого таблиц", "DatabaseChecker", content)
      }
    } catch (error) {
      logEvent("error", "Ошибка при проверке базы данных", "DatabaseChecker", error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkDatabase()
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Проверка базы данных
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isChecking ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Проверка базы данных...</span>
          </div>
        ) : tablesStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <h3 className="font-medium mb-2">Таблица матчей (matches)</h3>
                {tablesStatus.matchesExists ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Таблица существует
                  </div>
                ) : (
                  <div className="flex items-center text-amber-600">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Таблица не существует
                    {tablesStatus.errors?.matches && (
                      <span className="text-xs ml-2 text-red-500">{tablesStatus.errors.matches}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded-md p-3">
                <h3 className="font-medium mb-2">Таблица игроков (players)</h3>
                {tablesStatus.playersExists ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Таблица существует
                  </div>
                ) : (
                  <div className="flex items-center text-amber-600">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Таблица не существует
                    {tablesStatus.errors?.players && (
                      <span className="text-xs ml-2 text-red-500">{tablesStatus.errors.players}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {tablesStatus.exists && tablesContent && (
              <div className="space-y-4">
                <h3 className="font-medium">Содержимое таблиц:</h3>

                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-2">Игроки ({tablesContent.players.length})</h4>
                  {tablesContent.players.length > 0 ? (
                    <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
                      <pre className="text-xs">{JSON.stringify(tablesContent.players, null, 2)}</pre>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Таблица игроков пуста</p>
                  )}
                </div>

                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-2">Матчи ({tablesContent.matches.length})</h4>
                  {tablesContent.matches.length > 0 ? (
                    <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
                      <pre className="text-xs">{JSON.stringify(tablesContent.matches, null, 2)}</pre>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Таблица матчей пуста</p>
                  )}
                </div>
              </div>
            )}

            {!tablesStatus.exists && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-800" />
                <AlertTitle className="text-amber-800">Таблицы не созданы</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Для работы приложения необходимо создать таблицы в базе данных Supabase. Перейдите на вкладку "База
                  данных" для инициализации.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>Не удалось проверить статус таблиц. Проверьте соединение с Supabase.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={checkDatabase} disabled={isChecking}>
          {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Проверить базу данных
        </Button>
      </CardFooter>
    </Card>
  )
}
