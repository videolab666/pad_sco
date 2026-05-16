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
import { useLanguage } from "@/contexts/language-context"

export function DatabaseInitializer() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tablesStatus, setTablesStatus] = useState<any>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [initResult, setInitResult] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [customSql, setCustomSql] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [isExecutingSql, setIsExecutingSql] = useState(false)
  const { t } = useLanguage()

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
        await checkTables()
      }
    } catch (error: any) {
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
        await checkTables()
      }
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
          {t("debugPage.dbInitialization")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isChecking ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>{t("debugPage.checkingTablesStatus")}</span>
          </div>
        ) : tablesStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <h3 className="font-medium mb-2">{t("debugPage.matchesTable")}</h3>
                {tablesStatus.matchesExists ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {t("debugPage.tableExists")}
                  </div>
                ) : (
                  <div className="flex items-center text-amber-600">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {t("debugPage.tableNotExists")}
                    {tablesStatus.errors?.matches && (
                      <span className="text-xs ml-2 text-red-500">{tablesStatus.errors.matches}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded-md p-3">
                <h3 className="font-medium mb-2">{t("debugPage.playersTable")}</h3>
                {tablesStatus.playersExists ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {t("debugPage.tableExists")}
                  </div>
                ) : (
                  <div className="flex items-center text-amber-600">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {t("debugPage.tableNotExists")}
                    {tablesStatus.errors?.players && (
                      <span className="text-xs ml-2 text-red-500">{tablesStatus.errors.players}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!tablesStatus.exists && (
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-800" />
                <AlertTitle className="text-amber-800">{t("debugPage.tablesNotCreatedInit")}</AlertTitle>
                <AlertDescription className="text-amber-800">
                  {t("debugPage.tablesNotCreatedInitDesc")}
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
                  {initResult.success ? t("debugPage.successTitle") : t("debugPage.errorTitleShort")}
                </AlertTitle>
                <AlertDescription className={initResult.success ? "text-green-800" : ""}>
                  {initResult.success
                    ? initResult.message || t("debugPage.dbInitializedSuccess")
                    : `${t("debugPage.dbInitError")}: ${initResult.error}`}
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
                  {sqlResult.success ? t("debugPage.sqlExecutedSuccess") : t("debugPage.sqlExecutionError")}
                </AlertTitle>
                <AlertDescription className={sqlResult.success ? "text-green-800" : ""}>
                  {sqlResult.success ? t("debugPage.sqlQuerySuccess") : `${t("debugPage.sqlQueryError")}: ${sqlResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="init">
              <TabsList>
                <TabsTrigger value="init">{t("debugPage.tabAutoInit")}</TabsTrigger>
                <TabsTrigger value="manual">{t("debugPage.tabManualCreation")}</TabsTrigger>
                <TabsTrigger value="sql">{t("debugPage.tabSqlScript")}</TabsTrigger>
                <TabsTrigger value="custom">{t("debugPage.tabCustomSql")}</TabsTrigger>
              </TabsList>

              <TabsContent value="init" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  {t("debugPage.autoInitDescription")}
                </p>
                <Button onClick={handleInitializeDatabase} disabled={isInitializing || tablesStatus.exists}>
                  {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tablesStatus.exists
                    ? t("debugPage.tablesAlreadyCreated")
                    : isInitializing
                      ? t("debugPage.initializing")
                      : t("debugPage.initializeDatabase")}
                </Button>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  {t("debugPage.manualCreationDescription")}
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleCreateMatchesTable}
                    disabled={isExecutingSql || tablesStatus.matchesExists}
                    className="w-full"
                  >
                    {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tablesStatus.matchesExists
                      ? t("debugPage.matchesTableCreated")
                      : isExecutingSql
                        ? t("debugPage.creatingTable")
                        : t("debugPage.createMatchesTable")}
                  </Button>

                  <Button
                    onClick={handleCreatePlayersTable}
                    disabled={isExecutingSql || tablesStatus.playersExists}
                    className="w-full"
                  >
                    {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tablesStatus.playersExists
                      ? t("debugPage.playersTableCreated")
                      : isExecutingSql
                        ? t("debugPage.creatingTable")
                        : t("debugPage.createPlayersTable")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sql" className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("debugPage.sqlScriptDescription")}
                </p>
                <div className="bg-gray-100 p-3 rounded-md overflow-auto max-h-60">
                  <pre className="text-xs">{getCreateTablesSql()}</pre>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">{t("debugPage.customSqlDescription")}</p>
                <Textarea
                  value={customSql}
                  onChange={(e) => setCustomSql(e.target.value)}
                  placeholder={t("debugPage.enterSqlPlaceholder")}
                  rows={5}
                />
                <Button onClick={handleExecuteSql} disabled={isExecutingSql || !customSql.trim()}>
                  {isExecutingSql && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isExecutingSql ? t("debugPage.executing") : t("debugPage.executeSql")}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("debugPage.errorTitle")}</AlertTitle>
            <AlertDescription>{t("debugPage.checkTablesError")}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={checkTables} disabled={isChecking}>
          {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("debugPage.checkTablesStatus")}
        </Button>
      </CardFooter>
    </Card>
  )
}
