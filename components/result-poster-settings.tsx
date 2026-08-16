"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Send, Globe } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  buildResultPayload,
  postResultIfConfigured,
  postWithRetry,
} from "@/lib/result-poster"
import type { ResultPosterConfig } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

/**
 * Match-settings panel for the optional ResultPoster:
 *  - URL + Basic Auth username/password (free-form inputs)
 *  - "Auto-post on match complete" toggle
 *  - "Post now" button — only enabled when the match is completed
 *
 * Writes back into match.settings.resultPoster on Apply.
 */
export function ResultPosterSettings({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const initial: ResultPosterConfig = match?.settings?.resultPoster ?? {}
  const [url, setUrl] = useState<string>(initial.url ?? "")
  const [username, setUsername] = useState<string>(initial.basicAuth?.username ?? "")
  const [password, setPassword] = useState<string>(initial.basicAuth?.password ?? "")
  const [autoOnComplete, setAutoOnComplete] = useState<boolean>(initial.autoOnComplete ?? false)
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const buildConfig = (): ResultPosterConfig => ({
    url: url.trim() || undefined,
    basicAuth: username ? { username, password } : undefined,
    autoOnComplete,
  })

  const apply = () => {
    if (!match || !updateMatch) return
    const next = JSON.parse(JSON.stringify(match))
    next.settings = next.settings ?? {}
    next.settings.resultPoster = buildConfig()
    updateMatch(next)
  }

  const postNow = async () => {
    if (!match || !updateMatch) return
    setBusy(true)
    setLastResult(null)
    try {
      const config = buildConfig()
      // Use postWithRetry directly so the user gets feedback regardless of
      // isCompleted / autoOnComplete state.
      const r = await postWithRetry(config, buildResultPayload(match))
      setLastResult(r.ok ? `ok ${r.status ?? ""}` : `failed (${r.attempts})`)
      // Replay the audit trail through the completed-match path too if the
      // match is finished.
      const withAudit = await postResultIfConfigured(match)
      if (withAudit !== match) updateMatch(withAudit)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">{t("extras.resultPoster")}</span>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">{t("extras.resultPosterUrl")}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/results"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("extras.resultPosterUsername")}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t("extras.resultPosterPassword")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="autoOnComplete" className="text-xs">{t("extras.resultPosterAuto")}</Label>
            <Switch id="autoOnComplete" checked={autoOnComplete} onCheckedChange={setAutoOnComplete} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {lastResult ?? ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={postNow} disabled={busy || !url}>
              <Send className="h-4 w-4 mr-1" />
              {t("extras.resultPosterPostNow")}
            </Button>
            <Button size="sm" onClick={apply}>{t("extras.apply")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
