"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Plus, CircleDot } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { PlayerSelector } from "@/components/player-selector"
import { createMatch } from "@/lib/match-storage"
import { getPlayers, addPlayer } from "@/lib/player-storage"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"

// Добавим импорт функций для работы с кортами
import { getOccupiedCourts, isCourtAvailable } from "@/lib/court-utils"

// Custom animations for the button
const customStyles = `
  @keyframes gradient-x {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  .animate-gradient-x {
    background-size: 200% 200%;
    animation: gradient-x 3s ease infinite;
  }
  
  .orange-button-container {
    position: relative;
    width: 100%;
    overflow: visible;
  }
  
  .orange-button {
    position: relative;
    display: block;
    width: 100%;
    background: linear-gradient(90deg, #ff9d4d, #ff6b00, #ff9d4d);
    background-size: 200% auto;
    animation: gradient-x 3s ease infinite;
    border-radius: 0.5rem;
    padding: 3px;
    transition: transform 0.3s ease;
  }
  
  .orange-button:hover {
    transform: scale(1.03);
  }
  
  .orange-button-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(90deg, #ff7e1a, #e65c00, #ff7e1a);
    background-size: 200% auto;
    animation: gradient-x 3s ease infinite;
    border-radius: 0.375rem;
    width: 100%;
    padding: 0.75rem 1rem;
    position: relative;
    z-index: 1;
    transition: all 0.3s ease;
    color: white;
    font-weight: 500;
  }
  
  .orange-button:hover .orange-button-inner {
    background: linear-gradient(90deg, #ff8c33, #ff6600, #ff8c33);
    background-size: 200% auto;
  }
  
  .orange-button-glow {
    position: absolute;
    inset: -4px;
    background: linear-gradient(90deg, rgba(255, 157, 77, 0.5), rgba(255, 107, 0, 0.5), rgba(255, 157, 77, 0.5));
    background-size: 200% auto;
    animation: gradient-x 3s ease infinite;
    border-radius: 0.625rem;
    z-index: 0;
    filter: blur(8px);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .orange-button:hover .orange-button-glow {
    opacity: 1;
  }
  
  .arrow-icon {
    margin-left: 0.5rem;
    transition: transform 0.3s ease;
  }
  
  .orange-button:hover .arrow-icon {
    transform: translateX(4px);
  }
`

export default function NewMatchPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultType = "padel"
  const courtParam = searchParams.get("court")

  const [matchType, setMatchType] = useState("padel")
  const [matchFormat, setMatchFormat] = useState("doubles") // Изменено на "doubles" по умолчанию
  const [sets, setSets] = useState("3") // Изменено на "3" по умолчанию
  const [scoringSystem, setScoringSystem] = useState("classic")
  const [tiebreakEnabled, setTiebreakEnabled] = useState(true)
  const [tiebreakType, setTiebreakType] = useState("regular")
  const [tiebreakAt, setTiebreakAt] = useState("6-6")
  const [finalSetTiebreak, setFinalSetTiebreak] = useState(false)
  const [finalSetTiebreakLength, setFinalSetTiebreakLength] = useState("10") // New state for final set tiebreak length
  const [goldenGame, setGoldenGame] = useState(false)
  const [goldenPoint, setGoldenPoint] = useState(false)
  const [windbreak, setWindbreak] = useState(false)
  const [matchRound, setMatchRound] = useState<string | null>(null)
  const [players, setPlayers] = useState([])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [loading, setLoading] = useState(true)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [alertType, setAlertType] = useState("success") // success, error, warning
  const playersRef = useRef([]) // Reference to keep track of players without re-renders

  // Игроки для команд
  const [teamAPlayer1, setTeamAPlayer1] = useState("")
  const [teamAPlayer2, setTeamAPlayer2] = useState("")
  const [teamBPlayer1, setTeamBPlayer1] = useState("")
  const [teamBPlayer2, setTeamBPlayer2] = useState("")

  // Стороны корта
  const [teamASide, setTeamASide] = useState("left")
  const [servingTeam, setServingTeam] = useState("teamA")

  // Добавим состояние для выбора корта и списка занятых кортов
  const [courtNumber, setCourtNumber] = useState<number | null>(courtParam ? Number(courtParam) : null)
  const [occupiedCourts, setOccupiedCourts] = useState<number[]>([])
  const [loadingCourts, setLoadingCourts] = useState(true)
  const [isCourtOccupied, setIsCourtOccupied] = useState(false);

  // Force re-render counter
  const [, setForceUpdate] = useState(0)

  // Функция для проверки, занят ли корт (для выбора корта)
  const isCourtOccupiedFn = (courtNum: number) => occupiedCourts.includes(courtNum);

  // Проверка статуса корта по query-параметру
  const checkCourtStatus = async () => {
    setLoadingCourts(true);
    try {
      const courts = await getOccupiedCourts();
      setOccupiedCourts(courts);
      if (courtParam) {
        const courtNum = Number(courtParam);
        setIsCourtOccupied(courts.includes(courtNum));
        setCourtNumber(courtNum);
      }
    } finally {
      setLoadingCourts(false);
    }
  };

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const playersList = await getPlayers()
        setPlayers(playersList)
        playersRef.current = playersList // Store in ref for direct access
      } catch (error) {
        console.error("Ошибка при загрузке игроков:", error)
        logEvent("error", "Ошибка при загрузке игроков", "NewMatchPage", error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayers()

    // Set up event listener for storage changes (for cross-tab synchronization)
    const handleStorageChange = (e) => {
      if (e.key === "padel-tennis-players") {
        try {
          const updatedPlayers = JSON.parse(e.newValue || "[]")
          setPlayers(updatedPlayers)
          playersRef.current = updatedPlayers
        } catch (error) {
          console.error("Error parsing players from storage:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  useEffect(() => {
    checkCourtStatus();
  }, [courtParam]);

  // Add this useEffect after the other useEffect hooks
  useEffect(() => {
    // For 2-set matches, ensure final set tiebreak is enabled
    // but don't change the tiebreak type for regular sets
    if (sets === "2") {
      setFinalSetTiebreak(true)
    }
  }, [sets])

  // Показать уведомление
  const showNotification = (message, type = "success") => {
    setAlertMessage(message)
    setAlertType(type)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 3000)
  }

  // Показываем лоадер, пока идет проверка статуса корта
  if (loadingCourts) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  // Conditional court occupied UI (after all hooks)
  if (courtParam && isCourtOccupied) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Alert variant="destructive">
            <AlertTitle>{t("common.courtStatus.matchInProgress")}</AlertTitle>
            <AlertDescription>
              {t("common.courtStatus.matchInProgressDescription")}
            </AlertDescription>
          </Alert>
          <Button onClick={checkCourtStatus} className="mt-4">
            {t("common.courtStatus.refresh")}
          </Button>
        </div>
      </div>
    );
  }

  // Добавление нового игрока
  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return

    setIsAddingPlayer(true)
    try {
      const newPlayer = {
        id: uuidv4(),
        name: newPlayerName.trim(),
      }

      logEvent("info", "Попытка добавления нового игрока", "NewMatchPage", { name: newPlayerName })

      const result = await addPlayer(newPlayer)

      if (result.success) {
        setNewPlayerName("")
        showNotification(result.message)
        logEvent("info", "Игрок успешно добавлен", "NewMatchPage", { id: newPlayer.id, name: newPlayer.name })

        // Directly update the players array and ref
        const updatedPlayers = [...playersRef.current, newPlayer]
        playersRef.current = updatedPlayers
        setPlayers(updatedPlayers)

        // Force a re-render to ensure UI updates
        setForceUpdate((prev) => prev + 1)

        console.log("Player added:", newPlayer)
        console.log("Updated players list:", updatedPlayers)
      } else {
        showNotification(result.message, "error")
        logEvent("warn", "Не удалось добавить игрока", "NewMatchPage", {
          name: newPlayerName,
          reason: result.message,
        })
      }
    } catch (error) {
      console.error("Ошибка при добавлении игрока:", error)
      showNotification("Произошла ошибка при добавлении игрока", "error")
      logEvent("error", "Ошибка при добавлении игрока", "NewMatchPage", error)
    } finally {
      setIsAddingPlayer(false)
    }
  }

  // Обновим функцию handleCreateMatch, добавив номер корта
  const handleCreateMatch = async () => {
    // Проверка, что все необходимые игроки выбраны (только если нет courtParam)
    if (!courtParam) {
      if (!teamAPlayer1 || !teamBPlayer1) {
        showNotification(t("newMatch.selectAllPlayers"), "error")
        return
      }
      if (matchFormat === "doubles" && (!teamAPlayer2 || !teamBPlayer2)) {
        showNotification(t("newMatch.selectAllPlayersForDoubles"), "error")
        return
      }
    }

    // Проверка доступности корта
    if (courtNumber !== null) {
      const isAvailable = await isCourtAvailable(courtNumber)
      if (!isAvailable) {
        showNotification(t("newMatch.courtOccupied", { court: courtNumber }), "error")
        return
      }
    }

    // Создание объекта матча
    const generateNumericId = () => {
      // Генерируем 11-значный цифровой код
      let numericId = ""
      for (let i = 0; i < 11; i++) {
        numericId += Math.floor(Math.random() * 10).toString()
      }
      return numericId
    }

    // Ensure proper settings for final set tiebreak and handle Super Set logic
    const matchSettings = {
      sets: sets === "super" ? 1 : Number.parseInt(sets), // Super Set is played as 1 set
      scoringSystem: scoringSystem,
      tiebreakEnabled: sets === "super" ? true : tiebreakEnabled, // Always enable tiebreak for Super Set
      tiebreakType: sets === "super" ? "regular" : tiebreakType, // Use regular tiebreak for Super Set
      tiebreakAt: sets === "super" ? "8-8" : tiebreakAt, // Special tiebreak at 8-8 for Super Set
      finalSetTiebreak: sets === "2" ? true : finalSetTiebreak, // Always enable for 2-set matches
      finalSetTiebreakLength: Number.parseInt(finalSetTiebreakLength),
      goldenGame,
      goldenPoint,
      windbreak,
      // Add special Super Set settings
      isSuperSet: sets === "super",
      superSetTarget: 8, // Target is 8 games
      superSetTiebreakAt: 8, // Tiebreak at 8-8
    }

    // Добавляем отладочную информацию
    console.log("Creating match with settings:", {
      sets: sets,
      finalSetTiebreak: matchSettings.finalSetTiebreak,
      finalSetTiebreakLength: matchSettings.finalSetTiebreakLength,
      tiebreakType: matchSettings.tiebreakType,
    })

    const match = {
      id: generateNumericId(),
      type: matchType,
      format: matchFormat,
      createdAt: new Date().toISOString(),
      matchRound: matchRound, // Добавляем тип игры
      settings: matchSettings,
      teamA: {
        players: courtParam
          ? [
              { id: teamAPlayer1 || 'teamA-p1', name: teamAPlayer1 ? (players.find((p) => p.id === teamAPlayer1)?.name || teamAPlayer1) : 'Team1 - Player1' },
              ...(matchFormat === "doubles"
                ? [
                    { id: teamAPlayer2 || 'teamA-p2', name: teamAPlayer2 ? (players.find((p) => p.id === teamAPlayer2)?.name || teamAPlayer2) : 'Team1 - Player2' },
                  ]
                : []),
            ]
          : [
              { id: teamAPlayer1, name: players.find((p) => p.id === teamAPlayer1)?.name || teamAPlayer1 },
              ...(teamAPlayer2
                ? [{ id: teamAPlayer2, name: players.find((p) => p.id === teamAPlayer2)?.name || teamAPlayer2 }]
                : []),
            ],
        isServing: servingTeam === "teamA",
      },
      teamB: {
        players: courtParam
          ? [
              { id: teamBPlayer1 || 'teamB-p1', name: teamBPlayer1 ? (players.find((p) => p.id === teamBPlayer1)?.name || teamBPlayer1) : 'Team2 - Player1' },
              ...(matchFormat === "doubles"
                ? [
                    { id: teamBPlayer2 || 'teamB-p2', name: teamBPlayer2 ? (players.find((p) => p.id === teamBPlayer2)?.name || teamBPlayer2) : 'Team2 - Player2' },
                  ]
                : []),
            ]
          : [
              { id: teamBPlayer1, name: players.find((p) => p.id === teamBPlayer1)?.name || teamBPlayer1 },
              ...(teamBPlayer2
                ? [{ id: teamBPlayer2, name: players.find((p) => p.id === teamBPlayer2)?.name || teamBPlayer2 }]
                : []),
            ],
        isServing: servingTeam === "teamB",
      },
      score: {
        teamA: 0,
        teamB: 0,
        sets: [],
        currentSet: {
          teamA: 0,
          teamB: 0,
          games: [],
          currentGame: {
            teamA: 0,
            teamB: 0,
          },
        },
        isTiebreak: false,
      },
      currentServer: {
        team: servingTeam,
        playerIndex: 0,
      },
      courtSides: {
        teamA: teamASide,
        teamB: teamASide === "left" ? "right" : "left",
      },
      shouldChangeSides: false,
      history: [],
      isCompleted: false,
      courtNumber: courtNumber,
      created_via_court_link: !!courtParam,
      // Add special handling for Super Set
      superSetRules:
        sets === "super"
          ? {
              target: 8,
              tiebreakAt: 8,
              extendedTarget: 9, // For 7-7 scenario
            }
          : null,
    }

    // Сохранение матча и переход на страницу матча
    const matchId = await createMatch(match)
    router.push(`/match/${matchId}`)
  }


  return (
    <div className="container max-w-2xl mx-auto px-1.5 py-8">
      <style jsx global>
        {customStyles}
      </style>
      {showAlert && (
        <Alert
          className={`fixed top-4 right-4 w-auto z-50 ${
            alertType === "success"
              ? "bg-green-50 border-green-200"
              : alertType === "error"
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
          }`}
        >
          <AlertTitle>
            {alertType === "success"
              ? t("common.success")
              : alertType === "error"
                ? t("common.error")
                : t("common.warning")}
          </AlertTitle>
          <AlertDescription
            className={
              alertType === "success" ? "text-green-800" : alertType === "error" ? "text-red-800" : "text-amber-800"
            }
          >
            {alertMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-4">
        { !courtParam && (
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Button>
        )}
        <SupabaseStatus />
      </div>

      <OfflineNotice />

      <Card
        className={`${
          matchType === "tennis"
            ? "bg-gradient-to-r from-[#95ff81] to-[#58964c]"
            : "bg-gradient-to-r from-[#01a0e3] to-[#0056a9]"
        } transition-colors duration-500`}
      >
        <CardHeader className="text-white px-3">
          <CardTitle className="text-center text-white">{t("newMatch.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-3">
          <div className="w-full flex justify-center mb-4">
            <div className="flex items-center gap-2 bg-[#f5fef3] rounded-lg px-6 py-2 shadow-md">
              <CircleDot className="h-4 w-4 text-green-700" />
              <span className="font-semibold text-lg text-[#0056a9]">{t("home.padel")}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-md p-3 bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.format")}</Label>
              <Select value={matchFormat} onValueChange={setMatchFormat}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("newMatch.selectFormat")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">{t("newMatch.singles")}</SelectItem>
                  <SelectItem value="doubles">{t("newMatch.doubles")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md p-3 bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.sets")}</Label>
              <Select value={sets} onValueChange={setSets}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder={t("newMatch.selectSets")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("newMatch.oneSets")}</SelectItem>
                  <SelectItem value="3">{t("newMatch.threeSets")}</SelectItem>
                  <SelectItem value="5">{t("newMatch.fiveSets")}</SelectItem>
                  <SelectItem value="super">
                    <div>
                      <span className="font-medium">{t("newMatch.superSet")}</span>
                      <p className="text-xs text-muted-foreground">{t("newMatch.superSetDescription")}</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border border-green-200 rounded-md p-3 bg-green-50 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <Label>{t("newMatch.finalSetTiebreak")}</Label>
                <Switch
                  checked={finalSetTiebreak}
                  onCheckedChange={(checked) => {
                    setFinalSetTiebreak(checked)
                    console.log("Final set tiebreak changed to:", checked)
                  }}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {finalSetTiebreak && (
                <div className="space-y-2">
                  <Label>{t("newMatch.finalSetTiebreakLength")}</Label>
                  <Select
                    value={finalSetTiebreakLength}
                    onValueChange={(value) => {
                      setFinalSetTiebreakLength(value)
                      // Удаляем синхронизацию с типом тайбрейка
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("newMatch.selectTiebreakLength")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t("newMatch.tiebreakLength7")}</SelectItem>
                      <SelectItem value="10">{t("newMatch.tiebreakLength10")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-green-700 mt-1">
                    <p>{t("newMatch.finalSetTiebreakLengthDescription")}</p>
                    <p className="mt-1 font-medium">{t("newMatch.finalSetTiebreakNote")}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border rounded-md p-3 bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.scoringSystem")}</Label>
              <Select value={scoringSystem} onValueChange={setScoringSystem}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder={t("newMatch.selectScoringSystem")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">{t("newMatch.classicScoring")}</SelectItem>
                  <SelectItem value="no-ad">{t("newMatch.noAdScoring")}</SelectItem>
                  <SelectItem value="fast4">{t("newMatch.fast4Scoring")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md p-4 bg-[#f3f5f7] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <Label>{t("newMatch.tiebreak")}</Label>
                <Switch
                  checked={tiebreakEnabled}
                  onCheckedChange={setTiebreakEnabled}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {tiebreakEnabled && (
                <>
                  <div>
                    <Label>{t("newMatch.tiebreakType")}</Label>
                    <RadioGroup
                      value={tiebreakType}
                      onValueChange={(value) => {
                        setTiebreakType(value)
                        // Удаляем синхронизацию с длиной финального тайбрейка
                      }}
                      className="grid grid-cols-1 gap-2 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="regular" id="tiebreak-regular" />
                        <div>
                          <Label htmlFor="tiebreak-regular" className="font-medium">
                            {t("newMatch.regularTiebreak")}
                          </Label>
                          <p className="text-xs text-muted-foreground">До 7 очков (с разницей в 2 очка)</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="championship" id="tiebreak-championship" />
                        <div>
                          <Label htmlFor="tiebreak-championship" className="font-medium">
                            {t("newMatch.championshipTiebreak")}
                          </Label>
                          <p className="text-xs text-muted-foreground">До 10 очков (с разницей в 2 очка)</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="mt-4">
                    <Label>{t("newMatch.tiebreakAt")}</Label>
                    <Select value={tiebreakAt} onValueChange={setTiebreakAt}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("newMatch.selectTiebreakScore")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6-6">6:6</SelectItem>
                        <SelectItem value="5-5">5:5</SelectItem>
                        <SelectItem value="4-4">4:4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="border rounded-md p-4 bg-[#f8fdf9] shadow-md">
              <Label className="text-base font-medium">{t("newMatch.additional")}</Label>
              <div className="space-y-2 mt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="golden-game" checked={goldenGame} onCheckedChange={setGoldenGame} />
                  <Label htmlFor="golden-game" className="text-sm">
                    {t("newMatch.goldenGame")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="golden-point" checked={goldenPoint} onCheckedChange={setGoldenPoint} />
                  <Label htmlFor="golden-point" className="text-sm">
                    {t("newMatch.goldenPoint")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="windbreak" checked={windbreak} onCheckedChange={setWindbreak} />
                  <Label htmlFor="windbreak" className="text-sm">
                    {t("newMatch.windbreak")}
                  </Label>
                </div>
                <div className="mt-4 border rounded-md shadow-md bg-[#fdead1] p-2">
                  <Label>{t("newMatch.matchRound") || "Match Round"}</Label>
                  <Select
                    value={matchRound || ""}
                    onValueChange={(value) => setMatchRound(value === "" ? null : value)}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder={t("newMatch.selectMatchRound") || "Select match round"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                      <SelectItem value="semifinal">Semifinal</SelectItem>
                      <SelectItem value="quarterfinal">Quarterfinal</SelectItem>
                      <SelectItem value="round16">Round of 16</SelectItem>
                      <SelectItem value="round32">Round of 32</SelectItem>
                      <SelectItem value="round64">Round of 64</SelectItem>
                      <SelectItem value="round128">Round of 128</SelectItem>
                      <SelectItem value="qualificationFinal">Qualification Final</SelectItem>
                      <SelectItem value="qualificationRound2">Qualification Round 2</SelectItem>
                      <SelectItem value="qualificationRound1">Qualification Round 1</SelectItem>
                      <SelectItem value="prequalifying">Pre-qualifying</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-md p-4 bg-[#f8fdf9] shadow-md">
            <h3 className="font-medium mb-4">{t("newMatch.players")}</h3>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t("players.addPlayer")}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                  disabled={isAddingPlayer}
                />
                <Button onClick={handleAddPlayer} disabled={isAddingPlayer || !newPlayerName.trim()}>
                  {isAddingPlayer ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {t("common.add")}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  {t("common.loadingPlayers")}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <div className="pl-[0.03125rem] pr-0.5">
                    <Label>{t("match.teamA")}</Label>
                    <div className="space-y-0.5 mt-0.5">
                      <PlayerSelector
                        players={players}
                        value={teamAPlayer1}
                        onChange={setTeamAPlayer1}
                        placeholder={t("newMatch.player1")}
                      />

                      {matchFormat === "doubles" && (
                        <PlayerSelector
                          players={players}
                          value={teamAPlayer2}
                          onChange={setTeamAPlayer2}
                          placeholder={t("newMatch.player2")}
                        />
                      )}
                    </div>
                  </div>

                  <div className="px-0.5">
                    <Label>{t("match.teamB")}</Label>
                    <div className="space-y-0.5 mt-0.5">
                      <PlayerSelector
                        players={players}
                        value={teamBPlayer1}
                        onChange={setTeamBPlayer1}
                        placeholder={t("newMatch.player1")}
                      />

                      {matchFormat === "doubles" && (
                        <PlayerSelector
                          players={players}
                          value={teamBPlayer2}
                          onChange={setTeamBPlayer2}
                          placeholder={t("newMatch.player2")}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Первая подача - перемещена вверх */}
          <div className="w-full border rounded-md p-2 sm:p-3 mb-4 bg-[#f8fdf9] shadow-md">
            <Label className="block mb-1 sm:mb-2 text-[0.65rem] sm:text-sm">{t("newMatch.firstServe")}</Label>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div
                className={`p-2 rounded cursor-pointer ${servingTeam === "teamA" ? "bg-green-200 font-medium" : "bg-gray-100"}`}
                onClick={() => setServingTeam("teamA")}
              >
                {t("match.teamA")}
              </div>
              <div
                className={`p-2 rounded cursor-pointer ${servingTeam === "teamB" ? "bg-green-200 font-medium" : "bg-gray-100"}`}
                onClick={() => setServingTeam("teamB")}
              >
                {t("match.teamB")}
              </div>
            </div>
          </div>

          {/* Сторона команды A */}
          <div className="w-full border rounded-md p-2 sm:p-3 mb-4 bg-[#f8fdf9] shadow-md">
            <div className="flex justify-between items-center mb-1 sm:mb-2">
              <Label className="text-[0.65rem] sm:text-sm">{t("newMatch.teamASide")}</Label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div
                className={`p-2 rounded cursor-pointer ${teamASide === "left" ? "bg-blue-200 font-medium" : "bg-gray-100"}`}
                onClick={() => setTeamASide("left")}
              >
                {t("newMatch.left")}
              </div>
              <div
                className={`p-2 rounded cursor-pointer ${teamASide === "right" ? "bg-blue-200 font-medium" : "bg-gray-100"}`}
                onClick={() => setTeamASide("right")}
              >
                {t("newMatch.right")}
              </div>
            </div>
          </div>

          {/* Выбор корта или фиксированная надпись */}
          {courtParam ? (
            <div className="border rounded-md p-4 bg-[#e5febd] shadow-md mb-4 text-center">
              <Label className="text-[1.3rem] sm:text-sm">
                {t("newMatch.selectedCourt")} {courtParam}
              </Label>
            </div>
          ) : (
            <div className="border rounded-md p-4 bg-[#e5febd] shadow-md mb-4">
              <Label className="text-[1.3rem] sm:text-sm">{t("newMatch.courtSelection")}</Label>
              <div className="border rounded-md p-2 sm:p-3 bg-white mt-2">
                <div className="mb-2">
                  <RadioGroup
                    value={courtNumber === null ? "no-court" : courtNumber.toString()}
                    onValueChange={(value) => {
                      if (value === "no-court") {
                        setCourtNumber(null)
                      } else {
                        setCourtNumber(Number.parseInt(value))
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="no-court" id="no-court" className="scale-75 sm:scale-100" />
                      <Label
                        htmlFor="no-court"
                        className={`text-[1.3rem] sm:text-sm px-2 py-1 rounded-md transition-all duration-200 ${
                          courtNumber === null
                            ? "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 font-medium shadow-md"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        {t("newMatch.noCourt")}
                      </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        {/* Первый столбец: корты 1-5 */}
                        {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => (
                          <div key={num} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={num.toString()}
                              id={`court-${num}`}
                              disabled={isCourtOccupiedFn(num) || loadingCourts}
                              className="scale-75 sm:scale-100"
                            />
                            <Label
                              htmlFor={`court-${num}`}
                              className={`text-[1.3rem] sm:text-sm px-2 py-1 rounded-md transition-all duration-200 ${
                                courtNumber === num
                                  ? "bg-gradient-to-r from-green-100 to-green-200 text-green-800 font-medium shadow-md"
                                  : isCourtOccupiedFn(num)
                                    ? "text-muted-foreground line-through"
                                    : "hover:bg-gray-100"
                              }`}
                            >
                              {t("newMatch.court")} {num}
                            </Label>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {/* Второй столбец: корты 6-10 */}
                        {Array.from({ length: 5 }, (_, i) => i + 6).map((num) => (
                          <div key={num} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={num.toString()}
                              id={`court-${num}`}
                              disabled={isCourtOccupiedFn(num) || loadingCourts}
                              className="scale-75 sm:scale-100"
                            />
                            <Label
                              htmlFor={`court-${num}`}
                              className={`text-[1.3rem] sm:text-sm px-2 py-1 rounded-md transition-all duration-200 ${
                                courtNumber === num
                                  ? "bg-gradient-to-r from-green-100 to-green-200 text-green-800 font-medium shadow-md"
                                  : isCourtOccupiedFn(num)
                                    ? "text-muted-foreground line-through"
                                    : "hover:bg-gray-100"
                              }`}
                            >
                              {t("newMatch.court")} {num}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {loadingCourts ? (
                  <div className="text-center py-2 text-[1.3rem] sm:text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                    {t("newMatch.checkingCourtAvailability")}
                  </div>
                ) : occupiedCourts.length > 0 ? (
                  <div className="text-[1.3rem] sm:text-sm text-muted-foreground">
                    {t("newMatch.occupiedCourts")}: {occupiedCourts.sort((a, b) => a - b).join(", ")}
                  </div>
                ) : (
                  <div className="text-[1.3rem] sm:text-sm text-green-600">{t("newMatch.allCourtsAvailable")}</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="px-3">
          <div className="orange-button-container">
            <div className="orange-button">
              <div className="orange-button-glow"></div>
              <button className="orange-button-inner" onClick={handleCreateMatch}>
                {t("newMatch.startMatch")}
                <svg className="arrow-icon h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
