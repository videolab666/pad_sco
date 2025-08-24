"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Database, AlertCircle, CheckCircle } from "lucide-react"
import { checkTablesExist, initializeDatabase, getCreateTablesSql, executeSql } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export function DatabaseInitializer() {
  const [tablesStatus, setTablesStatus] = useState(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initResult, setInitResult] = useState(null)
  const [isChecking, setIsChecking] = useState(true)
  const [customSql, setCustomSql] = useState("")
  const [sqlResult, setSqlResult] = useState(null)
  const [isExecutingSql, setIsExecutingSql] = useState(false)

  const checkTables = async () => {
    setIsChecking(true)
    try {
      const status = await checkTablesExist()
      setTablesStatus(status)
      logEvent("info", "Проверка существования таблиц", "DatabaseInitializer", status)
    } catch (error) {
      logEvent("error", "Ошибка при проверке таблиц", "DatabaseInitializer", error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkTables()
  }, [])

  const handleInitializeDatabase = async () => {
    setIsInitializing(true)
    setInitResult(null)

    try {
      const result = await initializeDatabase()
      setInitResult(result)
      logEvent("info", "Результат инициализации базы данных", "DatabaseInitializer", result)

      if (result.success) {
        // Перепроверяем статус таблиц после инициализации
        await checkTables()
      }
    } catch (error) {
      logEvent("error", "Ошибка при инициализации базы данных", "DatabaseInitializer", error)
      setInitResult({ success: false, error: error.message })
    } finally {
      setIsInitializing(false)
    }
  }

  const handleExecuteSql = async () => {
    if (!customSql.trim()) return

    setIsExecutingSql(true)
    setSqlResult(null)

    try {
      const result = await executeSql(customSql)
      setSqlResult(result)
      logEvent("info", "Результат выполнения SQL", "DatabaseInitializer", result)

      if (result.success) {
        // Перепроверяем статус таблиц после выполнения SQL
        await checkTables()
      }
    } catch (error) {
      logEvent("error", "Ошибка при выполнении SQL", "DatabaseInitializer", error)
      setSqlResult({ success: false, error: error.message })
    } finally {
      setIsExecutingSql(false)
    }
  }

  const handleCreateMatchesTable = async () => {
    setIsExecutingSql(true)
    setSqlResult(null)

    try {
      const sql = `
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB NOT NULL,
  team_a JSONB NOT NULL,
  team_b JSONB NOT NULL,
  score JSONB NOT NULL,
  current_server JSONB NOT NULL,
  court_sides JSONB NOT NULL,
  should_change_sides BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  winner TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`

      const result = await executeSql(sql)
      setSqlResult(result)
      logEvent("info", "Результат создания таблицы matches", "DatabaseInitializer", result)

      if (result.success) {
        await checkTables()
      }
    } catch (error) {
      logEvent("error", "Ошибка при создании таблицы matches", "DatabaseInitializer", error)
      setSqlResult({ success: false, error: error.message })
    } finally {
      setIsExecutingSql(false)
    }
  }

  const handleCreatePlayersTable = async () => {
    setIsExecutingSql(true)
    setSqlResult(null)

    try {
      const sql = `
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS players_name_idx ON players (name);`

      const result = await executeSql(sql)
      setSqlResult(result)
      logEvent("info", "Результат создания таблицы players", "DatabaseInitializer", result)

      if (result.success) {
        await checkTables()
      }
    } catch (error) {
      logEvent("error", "Ошибка при создании таблицы players", "DatabaseInitializer", error)
      setSqlResult({ success: false, error: error.message })
    } finally {
      setIsExecutingSql(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Инициализация базы данных
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isChecking ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Проверка статуса таблиц...</span>
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

            {!tablesStatus.exists && (
              <Alert variant="warning" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-800" />
                <AlertTitle className="text-amber-800">Таблицы не созданы</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Для работы приложения необходимо создать таблицы в базе данных Supabase. Вы можете использовать
                  автоматическую инициализацию или создать таблицы вручную.
                </AlertDescription>
              </Alert>
            )}

            {initResult && (
              <Alert
                variant={initResult.success ? "default" : "destructive"}
                className={initResult.success ? "bg-green-50 border-green-200" : ""}
              >
                {initResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-800" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle className={initResult.success ? "text-green-800" : ""}>
                  {initResult.success ? "Успешно" : "Ошибка"}
                </AlertTitle>
                <AlertDescription className={initResult.success ? "text-green-800" : ""}>
                  {initResult.success
                    ? initResult.message || "База данных успешно инициализирована"
                    : `Ошибка при инициализации базы данных: ${initResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            {sqlResult && (
              <Alert
                variant={sqlResult.success ? "default" : "destructive"}
                className={sqlResult.success ? "bg-green-50 border-green-200" : ""}
              >
                {sqlResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-800" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle className={sqlResult.success ? "text-green-800" : ""}>
                  {sqlResult.success ? "SQL выполнен успешно" : "Ошибка выполнения SQL"}
                </AlertTitle>
                <AlertDescription className={sqlResult.success ? "text-green-800" : ""}>
                  {sqlResult.success ? "SQL-запрос успешно выполнен" : `Ошибка: ${sqlResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="init">
              <TabsList>
                <TabsTrigger value="init">Автоматическая инициализация</TabsTrigger>
                <TabsTrigger value="manual">Ручное создание</TabsTrigger>
                <TabsTrigger value="sql">SQL-скрипт</TabsTrigger>
                <TabsTrigger value="custom">Свой SQL</TabsTrigger>
              </TabsList>

              <TabsContent value="init" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Нажмите кнопку ниже, чтобы автоматически создать необходимые таблицы в базе данных Supabase. Этот
                  метод требует наличия функции exec_sql в вашей базе данных.
                </p>
                <Button onClick={handleInitializeDatabase} disabled={isInitializing || tablesStatus.exists}>
                  {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tablesStatus.exists
                    ? "Таблицы уже созданы"
                    : isInitializing
                      ? "Инициализация..."
                      : "Инициализировать базу данных"}
                </Button>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Создайте таблицы по отдельности, если автоматическая инициализация не работает.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleCreateMatchesTable}
                    disabled={isExecutingSql || tablesStatus.matchesExists}
                    className="w-full"
                  >
                    {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tablesStatus.matchesExists
                      ? "Таблица matches уже создана"
                      : isExecutingSql
                        ? "Создание таблицы..."
                        : "Создать таблицу matches"}
                  </Button>

                  <Button
                    onClick={handleCreatePlayersTable}
                    disabled={isExecutingSql || tablesStatus.playersExists}
                    className="w-full"
                  >
                    {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tablesStatus.playersExists
                      ? "Таблица players уже создана"
                      : isExecutingSql
                        ? "Создание таблицы..."
                        : "Создать таблицу players"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sql" className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Вы также можете выполнить этот SQL-скрипт вручную в SQL-редакторе Supabase:
                </p>
                <div className="bg-gray-100 p-3 rounded-md overflow-auto max-h-60">
                  <pre className="text-xs">{getCreateTablesSql()}</pre>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">Выполните произвольный SQL-запрос:</p>
                <Textarea
                  value={customSql}
                  onChange={(e) => setCustomSql(e.target.value)}
                  placeholder="Введите SQL-запрос..."
                  rows={5}
                />
                <Button onClick={handleExecuteSql} disabled={isExecutingSql || !customSql.trim()}>
                  {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isExecutingSql ? "Выполнение..." : "Выполнить SQL"}
                </Button>
              </TabsContent>
            </Tabs>
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
        <Button variant="outline" size="sm" onClick={checkTables} disabled={isChecking}>
          {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Проверить статус таблиц
        </Button>
      </CardFooter>
    </Card>
  )
}
