import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchHistoryList } from "@/components/match-history-list"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function HistoryPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <header className="flex flex-col items-center mb-8">
        <div className="w-full flex justify-between items-center mb-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              На главную
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold">История матчей</h1>
        <p className="text-muted-foreground">Просмотр и управление завершенными матчами</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <SupabaseStatus />
        </div>
      </header>

      <OfflineNotice />

      <Card>
        <CardHeader>
          <CardTitle>Завершенные матчи</CardTitle>
          <CardDescription>История всех сыгранных матчей</CardDescription>
        </CardHeader>
        <CardContent>
          <MatchHistoryList showControls={true} />
        </CardContent>
      </Card>
    </div>
  )
}
