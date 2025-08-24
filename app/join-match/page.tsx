"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getMatch } from "@/lib/match-storage"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"

export default function JoinMatchPage() {
  const router = useRouter()
  const [matchId, setMatchId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    if (!matchId.trim()) {
      setError("Введите код матча")
      return
    }

    setLoading(true)
    try {
      // Проверяем существование матча
      const match = await getMatch(matchId.trim())

      if (match) {
        router.push(`/match/${matchId.trim()}`)
      } else {
        setError("Матч не найден")
      }
    } catch (err) {
      setError("Ошибка при поиске матча")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <SupabaseStatus />
      </div>

      <OfflineNotice />

      <Card>
        <CardHeader>
          <CardTitle className="text-center">Присоединиться к матчу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Введите код матча"
              value={matchId}
              onChange={(e) => {
                setMatchId(e.target.value)
                setError("")
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              disabled={loading}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleJoin} disabled={loading}>
            {loading ? "Поиск матча..." : "Присоединиться"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
