"use client"

import { useState, useEffect } from "react"
import { getErrorLog, clearErrorLog, exportErrorLog, type LogEntry } from "@/lib/error-logger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Download, Trash2, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useLanguage } from "@/contexts/language-context"

export function ErrorLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useLanguage()

  const loadLogs = () => {
    setIsLoading(true)
    try {
      const errorLogs = getErrorLog()
      setLogs(errorLogs)
    } catch (error) {
      console.error("Ошибка при загрузке журнала:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleClearLogs = () => {
    if (confirm(t("debugPage.clearConfirm"))) {
      clearErrorLog()
      setLogs([])
    }
  }

  const handleExportLogs = () => {
    try {
      const jsonData = exportErrorLog()

      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `error-log-${format(new Date(), "yyyy-MM-dd-HH-mm")}.json`
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 0)
    } catch (error) {
      console.error("Ошибка при экспорте журнала:", error)
    }
  }

  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.level === filter)

  const getBadgeColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-800"
      case "warn":
        return "bg-amber-100 text-amber-800"
      case "info":
        return "bg-blue-100 text-blue-800"
      case "debug":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("debugPage.errorLogTitle")}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            {t("debugPage.refreshBtn")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLogs}>
            <Download className="h-4 w-4 mr-1" />
            {t("debugPage.exportBtn")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearLogs}>
            <Trash2 className="h-4 w-4 mr-1" />
            {t("debugPage.clearBtn")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" value={filter} onValueChange={setFilter}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">{t("debugPage.filterAll")} ({logs.length})</TabsTrigger>
            <TabsTrigger value="error">{t("debugPage.filterErrors")} ({logs.filter((log) => log.level === "error").length})</TabsTrigger>
            <TabsTrigger value="warn">{t("debugPage.filterWarnings")} ({logs.filter((log) => log.level === "warn").length})</TabsTrigger>
            <TabsTrigger value="info">{t("debugPage.filterInfo")} ({logs.filter((log) => log.level === "info").length})</TabsTrigger>
            <TabsTrigger value="debug">{t("debugPage.filterDebug")} ({logs.filter((log) => log.level === "debug").length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] border rounded-md p-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isLoading ? t("debugPage.loadingLog") : t("debugPage.noRecordsFound")}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start mb-1">
                      <Badge className={getBadgeColor(log.level)}>{log.level.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), "dd MMM yyyy HH:mm:ss", { locale: ru })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {log.source}
                      </Badge>
                      <p className="text-sm">{log.message}</p>
                    </div>
                    {log.details && (
                      <div className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                        <pre>{log.details}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {t("debugPage.logStorageNote")}
      </CardFooter>
    </Card>
  )
}
