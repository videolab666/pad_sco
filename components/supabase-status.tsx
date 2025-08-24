"use client"

import { useState, useEffect } from "react"
import { isSupabaseAvailable, getSupabaseConnectionInfo } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CloudOff, Cloud, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"

export function SupabaseStatus() {
  const [isConnected, setIsConnected] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [connectionInfo, setConnectionInfo] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    // Проверяем статус Supabase при монтировании компонента
    const checkSupabase = async () => {
      setIsChecking(true)
      try {
        const status = await isSupabaseAvailable()
        setIsConnected(status)

        // Получаем подробную информацию о соединении
        const info = await getSupabaseConnectionInfo()
        setConnectionInfo(info)

        // Логируем результат проверки
        logEvent(
          status ? "info" : "warn",
          `Статус соединения с Supabase: ${status ? "доступен" : "недоступен"}`,
          "SupabaseStatus",
          info,
        )
      } catch (error) {
        logEvent("error", "Ошибка при проверке статуса Supabase", "SupabaseStatus", error)
        setIsConnected(false)
      } finally {
        setIsChecking(false)
      }
    }

    // Проверяем сразу
    checkSupabase()

    // И периодически проверяем статус
    const interval = setInterval(checkSupabase, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleCheckNow = async () => {
    setIsChecking(true)
    try {
      const status = await isSupabaseAvailable()
      setIsConnected(status)

      // Получаем подробную информацию о соединении
      const info = await getSupabaseConnectionInfo()
      setConnectionInfo(info)

      logEvent(
        "info",
        `Ручная проверка соединения с Supabase: ${status ? "доступен" : "недоступен"}`,
        "SupabaseStatus",
        info,
      )
    } catch (error) {
      logEvent("error", "Ошибка при ручной проверке статуса Supabase", "SupabaseStatus", error)
      setIsConnected(false)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            <Badge
              variant="outline"
              className={`${
                isChecking
                  ? "bg-gray-100 text-gray-800"
                  : isConnected
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
              } flex items-center gap-1`}
            >
              {isChecking ? (
                <span className="animate-pulse">{t("common.checking")}</span>
              ) : (
                <>
                  {isConnected ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
                  {isConnected ? t("common.online") : t("common.offline")}
                </>
              )}
            </Badge>

            <Dialog open={showDetails} onOpenChange={setShowDetails}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                  <Info className="h-3 w-3" />
                  <span className="sr-only">{t("supabaseStatus.connectionInfo")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("supabaseStatus.connectionInfo")}</DialogTitle>
                  <DialogDescription>{t("supabaseStatus.connectionDetails")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={isConnected ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                    >
                      {isConnected ? t("supabaseStatus.connectionEstablished") : t("supabaseStatus.connectionMissing")}
                    </Badge>

                    <Button variant="outline" size="sm" onClick={handleCheckNow} disabled={isChecking}>
                      {isChecking ? t("common.checking") : t("supabaseStatus.checkNow")}
                    </Button>
                  </div>

                  {connectionInfo && (
                    <div className="border rounded-md p-3 text-sm">
                      <h4 className="font-medium mb-2">{t("supabaseStatus.connectionDetailsTitle")}</h4>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(connectionInfo, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!isConnected && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                      <h4 className="font-medium flex items-center gap-1 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        {t("supabaseStatus.possibleIssues")}
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>{t("supabaseStatus.issueInternet")}</li>
                        <li>{t("supabaseStatus.issueCredentials")}</li>
                        <li>{t("supabaseStatus.issueServer")}</li>
                        <li>{t("supabaseStatus.issueCors")}</li>
                        <li>{t("supabaseStatus.issueEnvVars")}</li>
                      </ul>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDetails(false)}>
                    {t("supabaseStatus.close")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isChecking
            ? t("supabaseStatus.checkingTooltip")
            : isConnected
              ? t("supabaseStatus.onlineTooltip")
              : t("supabaseStatus.offlineTooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
