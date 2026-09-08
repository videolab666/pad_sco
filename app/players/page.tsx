"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, Plus, Check, X, Loader2, Flag } from "lucide-react" // Добавляем иконку Flag
import { v4 as uuidv4 } from "uuid"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"
import { getPlayers, addPlayer, deletePlayers, subscribeToPlayersUpdates, updatePlayer } from "@/lib/player-storage"
import { getMatches, updateMatch } from "@/lib/match-storage"
import { applyPlayerToMatch } from "@/lib/player-live-sync"
import { syncMatchCommand } from "@/lib/match-sync"
import { CountryCombobox } from "@/components/country-combobox"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"

// Добавляем состояние для страны игрока
/** Input с мелкой подписью-подсказкой под полем. */
function FieldWithHint({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {children}
      <div className="text-[10px] leading-tight text-muted-foreground/80">{hint}</div>
    </div>
  )
}

export default function PlayersPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlayerName, setNewPlayerName] = useState("")
  const [newPlayerCountry, setNewPlayerCountry] = useState("") // Новое состояние для страны
  const [newPlayerAvatar, setNewPlayerAvatar] = useState("")
  const [newPlayerClub, setNewPlayerClub] = useState("")
  const [newPlayerSeed, setNewPlayerSeed] = useState("")
  const [newPlayerAbbrev, setNewPlayerAbbrev] = useState("")
  const [newPlayerNumber, setNewPlayerNumber] = useState("")
  const [newPlayerColor, setNewPlayerColor] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [alertType, setAlertType] = useState("success") // success, error, warning
  const [selectAll, setSelectAll] = useState(false)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [isDeletingPlayers, setIsDeletingPlayers] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editedPlayerName, setEditedPlayerName] = useState("")
  const [editedPlayerCountry, setEditedPlayerCountry] = useState("")
  const [editedPlayerAvatar, setEditedPlayerAvatar] = useState("")
  const [editedPlayerClub, setEditedPlayerClub] = useState("")
  const [editedPlayerSeed, setEditedPlayerSeed] = useState("")
  const [editedPlayerAbbrev, setEditedPlayerAbbrev] = useState("")
  const [editedPlayerNumber, setEditedPlayerNumber] = useState("")
  const [editedPlayerColor, setEditedPlayerColor] = useState("")
  const [isEditingPlayer, setIsEditingPlayer] = useState(false)
  const [applyToLive, setApplyToLive] = useState(true)

  // Обработчик обновления списка игроков
  const handlePlayersUpdate = useCallback((updatedPlayers: any[]) => {
    setPlayers(updatedPlayers)
  }, [])

  // Загрузка списка игроков
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const playersList = await getPlayers()
        setPlayers(playersList)
      } catch (error) {
        console.error("Ошибка при загрузке игроков:", error)
        logEvent("error", "Ошибка при загрузке игроков", "PlayersPage", error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayers()

    // Подписываемся на обновления списка игроков
    const unsubscribe = subscribeToPlayersUpdates(handlePlayersUpdate)

    return () => {
      // Отписываемся при размонтировании компонента
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [handlePlayersUpdate])

  // Показать уведомление
  const showNotification = (message: string, type = "success") => {
    setAlertMessage(message)
    setAlertType(type)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 3000)
  }

  // hard guard against double-add of a player (synchronous — catches same-tick clicks)
  const addingPlayerRef = useRef(false)

  // Обновляем функцию добавления игрока, чтобы она включала страну
  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    if (addingPlayerRef.current) return

    addingPlayerRef.current = true
    setIsAddingPlayer(true)
    try {
      const newPlayer = {
        id: uuidv4(),
        name: newPlayerName.trim(),
        country: newPlayerCountry.trim() || undefined, // Добавляем страну
        avatar: newPlayerAvatar.trim() || undefined,
        club: newPlayerClub.trim() || undefined,
        seed: newPlayerSeed.trim() || undefined,
        abbreviation: newPlayerAbbrev.trim() || undefined,
        number: Number.parseInt(newPlayerNumber) || undefined,
        color: newPlayerColor.trim() || undefined,
      }

      logEvent("info", "Попытка добавления нового игрока", "PlayersPage", {
        name: newPlayerName,
        country: newPlayerCountry,
      })

      const result = await addPlayer(newPlayer)

      if (result.success) {
        setNewPlayerName("")
        setNewPlayerCountry("") // Сбрасываем страну
        setNewPlayerAvatar("")
        setNewPlayerClub(""); setNewPlayerSeed(""); setNewPlayerAbbrev(""); setNewPlayerNumber(""); setNewPlayerColor("")
        showNotification(result.message)
        logEvent("info", "Игрок успешно добавлен", "PlayersPage", {
          id: newPlayer.id,
          name: newPlayer.name,
          country: newPlayer.country,
        })
      } else {
        showNotification(result.message, "error")
        logEvent("warn", "Не удалось добавить игрока", "PlayersPage", {
          name: newPlayerName,
          country: newPlayerCountry,
          reason: result.message,
        })
      }
    } catch (error) {
      console.error("Ошибка при добавлении игрока:", error)
      showNotification(t("players.errorAddingPlayer"), "error")
      logEvent("error", "Ошибка при добавлении игрока", "PlayersPage", error)
    } finally {
      addingPlayerRef.current = false
      setIsAddingPlayer(false)
    }
  }

  // Удаление выбранных игроков
  const handleDeletePlayers = async () => {
    if (selectedPlayers.length === 0) return

    setIsDeletingPlayers(true)
    setShowDeleteDialog(false)

    try {
      logEvent("info", "Попытка удаления игроков", "PlayersPage", {
        count: selectedPlayers.length,
        ids: selectedPlayers,
      })

      const success = await deletePlayers(selectedPlayers)

      if (success) {
        showNotification(`Удалено игроков: ${selectedPlayers.length}`)
        setSelectedPlayers([])
        setSelectAll(false)
        logEvent("info", "Игроки успешно удалены", "PlayersPage", { count: selectedPlayers.length })
      } else {
        showNotification("Ошибка при удалении игроков", "error")
        logEvent("error", "Не удалось удалить игроков", "PlayersPage")
      }
    } catch (error) {
      console.error("Ошибка при удалении игроков:", error)
      showNotification(t("players.errorDeletingPlayers"), "error")
      logEvent("error", "Ошибка при удалении игроков", "PlayersPage", error)
    } finally {
      setIsDeletingPlayers(false)
    }
  }

  // Выбор/отмена выбора игрока
  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId)
      } else {
        return [...prev, playerId]
      }
    })
  }

  // Выбор/отмена выбора всех игроков
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedPlayers([])
    } else {
      setSelectedPlayers(players.map((player) => player.id))
    }
    setSelectAll(!selectAll)
  }

  // Обновление состояния selectAll при изменении выбранных игроков
  useEffect(() => {
    if (players.length > 0 && selectedPlayers.length === players.length) {
      setSelectAll(true)
    } else if (selectAll && selectedPlayers.length !== players.length) {
      setSelectAll(false)
    }
  }, [selectedPlayers, players, selectAll])

  // Обновление игрока
  const handleUpdatePlayer = async () => {
    if (!editedPlayerName.trim() || !editingPlayerId) return

    setIsEditingPlayer(true)
    try {
      logEvent("info", "Попытка обновления игрока", "PlayersPage", {
        id: editingPlayerId,
        name: editedPlayerName,
        country: editedPlayerCountry,
      })

      const updatedPlayer = {
        name: editedPlayerName.trim(),
        country: editedPlayerCountry.trim() || undefined,
        avatar: editedPlayerAvatar.trim() || undefined,
        club: editedPlayerClub.trim() || undefined,
        seed: editedPlayerSeed.trim() || undefined,
        abbreviation: editedPlayerAbbrev.trim() || undefined,
        number: Number.parseInt(editedPlayerNumber) || undefined,
        color: editedPlayerColor.trim() || undefined,
      }

      const result = await updatePlayer(editingPlayerId, updatedPlayer)

      if (result.success) {
        // Live-sync: push the display fields into active matches holding
        // this player, so running scoreboards pick the fix up via realtime.
        if (applyToLive) {
          try {
            const livePlayer = { id: editingPlayerId, ...updatedPlayer }
            const matches = await getMatches()
            let synced = 0
            for (const m of matches) {
              if (m?.isCompleted) continue
              const next = applyPlayerToMatch(m, livePlayer as any)
              if (next !== m) {
                next.revision = typeof m.revision === "number" ? m.revision : 0
                syncMatchCommand(next, "set-rosters", { teamA: next.teamA, teamB: next.teamB }, "players-page")
                await updateMatch(next, { localOnly: true })
                synced++
              }
            }
            if (synced > 0) showNotification(`${result.message} · ${t("players.liveSynced", { n: synced })}`)
            else showNotification(result.message)
          } catch (e) {
            console.error("live-sync error", e)
            showNotification(result.message)
          }
        } else showNotification(result.message)
        setEditingPlayerId(null)
        setEditedPlayerName("")
        setEditedPlayerCountry("")
        setEditedPlayerAvatar("")
        setEditedPlayerClub(""); setEditedPlayerSeed(""); setEditedPlayerAbbrev(""); setEditedPlayerNumber(""); setEditedPlayerColor("")
        logEvent("info", "Игрок успешно обновлен", "PlayersPage", {
          id: editingPlayerId,
          name: editedPlayerName,
          country: editedPlayerCountry,
        })
      } else {
        showNotification(result.message, "error")
        logEvent("warn", "Не удалось обновить игрока", "PlayersPage", {
          id: editingPlayerId,
          reason: result.message,
        })
      }
    } catch (error) {
      console.error("Ошибка при обновлении игрока:", error)
      showNotification(t("players.errorUpdatingPlayer"), "error")
      logEvent("error", "Ошибка при обновлении игрока", "PlayersPage", error)
    } finally {
      setIsEditingPlayer(false)
    }
  }

  // Начать редактирование игрока
  const startEditingPlayer = (player: any) => {
    setEditingPlayerId(player.id)
    setEditedPlayerName(player.name)
    setEditedPlayerCountry(player.country || "")
    setEditedPlayerAvatar(player.avatar || "")
    setEditedPlayerClub(player.club || "")
    setEditedPlayerSeed(player.seed || "")
    setEditedPlayerAbbrev(player.abbreviation || "")
    setEditedPlayerNumber(player.number ? String(player.number) : "")
    setEditedPlayerColor(player.color || "")
  }

  // Отменить редактирование
  const cancelEditing = () => {
    setEditingPlayerId(null)
    setEditedPlayerName("")
    setEditedPlayerCountry("")
    setEditedPlayerAvatar("")
    setEditedPlayerClub(""); setEditedPlayerSeed(""); setEditedPlayerAbbrev(""); setEditedPlayerNumber(""); setEditedPlayerColor("")
  }

  // Обновляем форму добавления игрока, чтобы включить поле для страны
  // Заменяем блок с формой добавления игрока
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      {showAlert && (
        <Alert
          className={`fixed top-4 right-4 w-auto z-50 ${alertType === "success"
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
        <Button variant="ghost" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("matchPage.home")}
        </Button>
        <SupabaseStatus />
      </div>

      <OfflineNotice />

      <Card>
        <CardHeader>
          <CardTitle className="text-center">{t("players.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={t("players.name")}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  disabled={isAddingPlayer}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <FieldWithHint label={t("players.countryAbbreviation")} hint={t("players.countryHint")}>
                  <CountryCombobox value={newPlayerCountry} onChange={setNewPlayerCountry} disabled={isAddingPlayer} />
                </FieldWithHint>
                <FieldWithHint label={t("players.avatarUrl")} hint={t("players.avatarHint")}>
                  <Input
                    value={newPlayerAvatar}
                    onChange={(e) => setNewPlayerAvatar(e.target.value)}
                    disabled={isAddingPlayer}
                    onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                  />
                </FieldWithHint>
                <FieldWithHint label={t("players.club")} hint={t("players.clubHint")}>
                  <Input
                    value={newPlayerClub}
                    onChange={(e) => setNewPlayerClub(e.target.value)}
                    disabled={isAddingPlayer}
                    onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                  />
                </FieldWithHint>
                <FieldWithHint label={t("players.seed")} hint={t("players.seedHint")}>
                  <Input
                    value={newPlayerSeed}
                    onChange={(e) => setNewPlayerSeed(e.target.value)}
                    maxLength={4}
                    disabled={isAddingPlayer}
                    onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                  />
                </FieldWithHint>
                <FieldWithHint label={t("players.abbreviation")} hint={t("players.abbreviationHint")}>
                  <Input
                    value={newPlayerAbbrev}
                    onChange={(e) => setNewPlayerAbbrev(e.target.value.toUpperCase())}
                    maxLength={5}
                    disabled={isAddingPlayer}
                    onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                  />
                </FieldWithHint>
                <FieldWithHint label={t("players.color")} hint={t("players.colorHint")}>
                  <div className="flex gap-1">
                    <Input
                      type="color"
                      value={newPlayerColor || "#1164a5"}
                      onChange={(e) => setNewPlayerColor(e.target.value)}
                      className="w-10 h-9 p-0.5"
                      disabled={isAddingPlayer}
                    />
                    <Input
                      value={newPlayerColor}
                      onChange={(e) => setNewPlayerColor(e.target.value)}
                      placeholder="#1164a5"
                      disabled={isAddingPlayer}
                      onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
                    />
                  </div>
                </FieldWithHint>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddPlayer} disabled={isAddingPlayer || !newPlayerName.trim()}>
                  {isAddingPlayer ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {t("common.add")}
                </Button>
              </div>
            </div>

            {/* Код выбора всех игроков остается без изменений */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={toggleSelectAll}
                  disabled={players.length === 0 || isDeletingPlayers || editingPlayerId !== null}
                />
                <Label htmlFor="select-all" className="text-sm">
                  {t("players.selectAll")}
                </Label>
              </div>

              <Button
                variant="destructive"
                size="sm"
                disabled={selectedPlayers.length === 0 || isDeletingPlayers || editingPlayerId !== null}
                className="flex items-center"
                onClick={() => setShowDeleteDialog(true)}
              >
                {isDeletingPlayers ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("players.deleteSelected")} ({selectedPlayers.length})
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                {t("players.loadingPlayers")}
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">{t("players.emptyList")}</div>
            ) : (
              <div className="border rounded-md divide-y">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3">
                    {editingPlayerId === player.id ? (
                      // Форма редактирования
                      <div className="flex flex-col w-full space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={editedPlayerName}
                            onChange={(e) => setEditedPlayerName(e.target.value)}
                            placeholder={t("players.name")}
                            className="flex-1"
                            disabled={isEditingPlayer}
                          />
                          <CountryCombobox value={editedPlayerCountry} onChange={setEditedPlayerCountry} disabled={isEditingPlayer} />
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={editedPlayerAvatar}
                            onChange={(e) => setEditedPlayerAvatar(e.target.value)}
                            placeholder={t("players.avatarUrl")}
                            className="flex-1"
                            disabled={isEditingPlayer}
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <FieldWithHint label={t("players.club")} hint={t("players.clubHint")}>
                            <Input value={editedPlayerClub} onChange={(e) => setEditedPlayerClub(e.target.value)} disabled={isEditingPlayer} />
                          </FieldWithHint>
                          <FieldWithHint label={t("players.seed")} hint={t("players.seedHint")}>
                            <Input value={editedPlayerSeed} onChange={(e) => setEditedPlayerSeed(e.target.value)} maxLength={4} disabled={isEditingPlayer} />
                          </FieldWithHint>
                          <FieldWithHint label={t("players.abbreviation")} hint={t("players.abbreviationHint")}>
                            <Input value={editedPlayerAbbrev} onChange={(e) => setEditedPlayerAbbrev(e.target.value.toUpperCase())} maxLength={5} disabled={isEditingPlayer} />
                          </FieldWithHint>
                          <FieldWithHint label={t("players.color")} hint={t("players.colorHint")}>
                            <div className="flex gap-1">
                              <Input
                                type="color"
                                value={editedPlayerColor || "#1164a5"}
                                onChange={(e) => setEditedPlayerColor(e.target.value)}
                                className="w-10 h-9 p-0.5"
                                disabled={isEditingPlayer}
                              />
                              <Input value={editedPlayerColor} onChange={(e) => setEditedPlayerColor(e.target.value)} placeholder="#1164a5" disabled={isEditingPlayer} />
                            </div>
                          </FieldWithHint>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={applyToLive}
                            onChange={(e) => setApplyToLive(e.target.checked)}
                          />
                          {t("players.applyToLive")}
                        </label>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleUpdatePlayer}
                            disabled={isEditingPlayer || !editedPlayerName.trim()}
                            className="flex-1"
                          >
                            {isEditingPlayer ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            {t("common.save")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isEditingPlayer}
                            className="flex-1"
                          >
                            <X className="mr-2 h-4 w-4" />
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Обычный вид
                      <>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`player-${player.id}`}
                            checked={selectedPlayers.includes(player.id)}
                            onCheckedChange={() => togglePlayerSelection(player.id)}
                            disabled={isDeletingPlayers || editingPlayerId !== null}
                          />
                          <Label htmlFor={`player-${player.id}`} className="font-medium">
                            {player.name}{" "}
                            {player.country && (
                              <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-md">
                                <Flag className="h-3 w-3 inline mr-1" />
                                {player.country}
                              </span>
                            )}
                          </Label>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => startEditingPlayer(player)}
                            disabled={isDeletingPlayers || editingPlayerId !== null}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-blue-500"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => togglePlayerSelection(player.id)}
                            disabled={isDeletingPlayers || editingPlayerId !== null}
                          >
                            {selectedPlayers.includes(player.id) ? (
                              <X className="h-4 w-4 text-red-500" />
                            ) : (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {t("players.totalPlayers")}: {players.length}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("players.selected")}: {selectedPlayers.length}
          </div>
        </CardFooter>
      </Card>

      {/* Диалог подтверждения удаления остается без изменений */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("players.deletePlayers")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("players.deletePlayersConfirm")} ({selectedPlayers.length})? {t("players.deletePlayersWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlayers}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
