"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
// Custom function to replace date-fns formatDistanceToNow
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`

  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`
}

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Filter, RefreshCw, Eye } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteMatch, getAllMatches, getMatches } from "@/lib/match-storage"
import { toast } from "@/components/ui/use-toast"

// Обновляем тип Match, чтобы включить информацию о сетах
type Match = {
  id: string
  date: string
  team1: {
    player1: string
    player2: string
    score: number
  }
  team2: {
    player1: string
    player2: string
    score: number
  }
  completed: boolean
  courtNumber?: number | null
  // Добавляем информацию о сетах
  sets?: Array<{
    teamA: string
    teamB: string
    winner?: string
  }>
  currentSet?: {
    teamA: string
    teamB: string
  }
}

interface MatchHistoryListProps {
  showControls?: boolean
}

export function MatchHistoryList({ showControls = false }: MatchHistoryListProps) {
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [courtFilter, setCourtFilter] = useState<string>("all")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    // Загружаем матчи при монтировании компонента
    loadMatches()
  }, [])

  const loadMatches = async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("Загрузка матчей...")

      // Используем функцию getMatches из match-storage.ts для получения полных данных о матчах
      const matchesFromStorage = await getMatches()
      console.log("getMatches вернул:", matchesFromStorage.length, matchesFromStorage)

      if (matchesFromStorage && matchesFromStorage.length > 0) {
        // Преобразуем формат данных для совместимости с компонентом
        const formattedMatches = matchesFromStorage.map((match) => ({
          id: match.id,
          date: match.createdAt || new Date().toISOString(),
          team1: {
            player1: match.teamA?.players?.[0]?.name || "Игрок 1",
            player2: match.teamA?.players?.[1]?.name || "Игрок 2",
            score: match.score?.teamA || 0,
          },
          team2: {
            player1: match.teamB?.players?.[0]?.name || "Игрок 3",
            player2: match.teamB?.players?.[1]?.name || "Игрок 4",
            score: match.score?.teamB || 0,
          },
          completed: match.isCompleted || false,
          courtNumber: match.courtNumber || null,
          // Добавляем информацию о сетах
          sets: match.score?.sets || [],
          currentSet: match.score?.currentSet || null,
        }))

        console.log("Форматированные матчи с сетами:", formattedMatches)
        setMatches(formattedMatches)
        setFilteredMatches(formattedMatches)
      } else {
        // Если getMatches не вернул матчи, пробуем получить их через getAllMatches
        console.log("getMatches вернул пустой массив, пробуем getAllMatches...")
        const allMatches = await getAllMatches()
        console.log("Получено матчей через getAllMatches:", allMatches.length, allMatches)

        if (allMatches && allMatches.length > 0) {
          setMatches(allMatches)
          setFilteredMatches(allMatches)
        } else {
          setError("Матчи не найдены в хранилище")
        }
      }
    } catch (error) {
      console.error("Ошибка при загрузке матчей:", error)
      setError(`Ошибка при загрузке матчей: ${error.message}`)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю матчей",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (courtFilter === "all") {
      setFilteredMatches(matches)
    } else {
      const courtNumber = Number.parseInt(courtFilter)
      setFilteredMatches(matches.filter((match) => match.courtNumber === courtNumber))
    }
  }, [courtFilter, matches])

  const openDeleteDialog = (id: string) => {
    setMatchToDelete(id)
    setDialogOpen(true)
  }

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return

    setIsDeleting(true)
    try {
      await deleteMatch(matchToDelete)
      setMatches((prevMatches) => prevMatches.filter((match) => match.id !== matchToDelete))
      toast({
        title: "Матч удален",
        description: "Матч был успешно удален из истории",
      })
    } catch (error) {
      console.error("Ошибка при удалении матча:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить матч",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDialogOpen(false)
      setMatchToDelete(null)
    }
  }

  // Получаем уникальные номера кортов для фильтра
  const courtNumbers = Array.from(new Set(matches.map((match) => match.courtNumber).filter(Boolean))).sort(
    (a, b) => (a || 0) - (b || 0),
  )

  if (isLoading) {
    return <div className="text-center py-8">Загрузка матчей...</div>
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={loadMatches} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Попробовать снова
        </Button>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">Нет матчей. Начните с создания нового матча!</p>
        <Button onClick={loadMatches} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showControls && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={courtFilter} onValueChange={setCourtFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Фильтр по корту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все корты</SelectItem>
                {courtNumbers.map((court) => (
                  <SelectItem key={court} value={court?.toString() || ""}>
                    Корт {court}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={loadMatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
      )}

      {filteredMatches.map((match) => (
        <Card key={match.id} className="hover:bg-muted/50 transition-colors">
          <CardContent className={`p-4 ${!match.completed ? "bg-[#fef6f6] shadow-sm" : "bg-[#f0f2fc] shadow-sm"}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {match.date ? formatTimeAgo(new Date(match.date)) : "Recently"}
                </span>
                {match.courtNumber && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100 shadow-sm">
                    Корт {match.courtNumber}
                  </Badge>
                )}
              </div>
              {match.completed ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100 shadow-sm">
                  Завершен
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-[#a5fe50] text-green-800 hover:bg-[#a5fe50] shadow-sm">
                  В процессе
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <div className="text-left">
                <div className="mb-1">
                  <p
                    className={`text-xs sm:text-sm truncate ${match.completed && match.team1.score > match.team2.score ? "font-bold" : "font-medium"}`}
                  >
                    {match.team1.player1}
                  </p>
                  <p
                    className={`text-xs sm:text-sm truncate ${match.completed && match.team1.score > match.team2.score ? "font-bold" : "font-medium"}`}
                  >
                    {match.team1.player2}
                  </p>
                </div>
                <div className="h-px bg-gray-200 my-1.5 w-full"></div>
                <div>
                  <p
                    className={`text-xs sm:text-sm truncate ${match.completed && match.team2.score > match.team1.score ? "font-bold" : "font-medium"}`}
                  >
                    {match.team2.player1}
                  </p>
                  <p
                    className={`text-xs sm:text-sm truncate ${match.completed && match.team2.score > match.team1.score ? "font-bold" : "font-medium"}`}
                  >
                    {match.team2.player2}
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <div className="text-right flex items-center justify-end">
                  <span className="font-bold text-base sm:text-xl mr-2">{match.team1.score}</span>
                  <span className="h-4 w-px bg-gray-300 mx-1.5"></span>
                  {/* Добавляем счет по сетам с проверкой наличия данных */}
                  <div className="text-xs text-gray-600">
                    {match.sets && Array.isArray(match.sets) ? (
                      match.sets.map((set, idx) => (
                        <span
                          key={idx}
                          className={`mr-1 px-1 rounded shadow-sm ${
                            Number.parseInt(set.teamA) > Number.parseInt(set.teamB)
                              ? "bg-[#fffec0]" // Победитель
                              : "bg-[#dff1ff]" // Проигравший
                          }`}
                        >
                          {set.teamA}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                    {match.currentSet && !match.completed && (
                      <span className="mr-1 bg-green-100 px-1 rounded shadow-sm">{match.currentSet.teamA}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex items-center justify-end">
                  <span className="font-bold text-base sm:text-xl mr-2">{match.team2.score}</span>
                  <span className="h-4 w-px bg-gray-300 mx-1.5"></span>
                  {/* Добавляем счет по сетам с проверкой наличия данных */}
                  <div className="text-xs text-gray-600">
                    {match.sets && Array.isArray(match.sets) ? (
                      match.sets.map((set, idx) => (
                        <span
                          key={idx}
                          className={`mr-1 px-1 rounded shadow-sm ${
                            Number.parseInt(set.teamB) > Number.parseInt(set.teamA)
                              ? "bg-[#fffec0]" // Победитель
                              : "bg-[#dff1ff]" // Проигравший
                          }`}
                        >
                          {set.teamB}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                    {match.currentSet && !match.completed && (
                      <span className="mr-1 bg-green-100 px-1 rounded shadow-sm">{match.currentSet.teamB}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {showControls && (
              <div className="flex justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="shadow-md bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200"
                >
                  <Link href={`/match/${match.id}`}>
                    <Eye className="h-4 w-4 mr-1 text-blue-600" />
                    Просмотр
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-md bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-red-200 text-red-500 hover:text-red-700"
                  onClick={() => openDeleteDialog(match.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить матч?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить. Матч будет удален из истории.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMatch}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-700"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
