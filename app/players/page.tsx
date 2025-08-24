"use client"

import { useState, useEffect, useCallback } from "react"
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
export default function PlayersPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPlayerName, setNewPlayerName] = useState("")
  const [newPlayerCountry, setNewPlayerCountry] = useState("") // Новое состояние для страны
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [alertType, setAlertType] = useState("success") // success, error, warning
  const [selectAll, setSelectAll] = useState(false)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [isDeletingPlayers, setIsDeletingPlayers] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editedPlayerName, setEditedPlayerName] = useState("")
  const [editedPlayerCountry, setEditedPlayerCountry] = useState("")
  const [isEditingPlayer, setIsEditingPlayer] = useState(false)

  // Обработчик обновления списка игроков
  const handlePlayersUpdate = useCallback((updatedPlayers) => {
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
  const showNotification = (message, type = "success") => {
    setAlertMessage(message)
    setAlertType(type)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 3000)
  }

  // Обновляем функцию добавления игрока, чтобы она включала страну
  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return

    setIsAddingPlayer(true)
    try {
      const newPlayer = {
        id: uuidv4(),
        name: newPlayerName.trim(),
        country: newPlayerCountry.trim() || null, // Добавляем страну
      }

      logEvent("info", "Попытка добавления нового игрока", "PlayersPage", {
        name: newPlayerName,
        country: newPlayerCountry,
      })

      const result = await addPlayer(newPlayer)

      if (result.success) {
        setNewPlayerName("")
        setNewPlayerCountry("") // Сбрасываем страну
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
  const togglePlayerSelection = (playerId) => {
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
    if (!editedPlayerName.trim()) return

    setIsEditingPlayer(true)
    try {
      logEvent("info", "Попытка обновления игрока", "PlayersPage", {
        id: editingPlayerId,
        name: editedPlayerName,
        country: editedPlayerCountry,
      })

      const updatedPlayer = {
        name: editedPlayerName.trim(),
        country: editedPlayerCountry.trim() || null,
      }

      const result = await updatePlayer(editingPlayerId, updatedPlayer)

      if (result.success) {
        showNotification(result.message)
        setEditingPlayerId(null)
        setEditedPlayerName("")
        setEditedPlayerCountry("")
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
  const startEditingPlayer = (player) => {
    setEditingPlayerId(player.id)
    setEditedPlayerName(player.name)
    setEditedPlayerCountry(player.country || "")
  }

  // Отменить редактирование
  const cancelEditing = () => {
    setEditingPlayerId(null)
    setEditedPlayerName("")
    setEditedPlayerCountry("")
  }

  // Обновляем форму добавления игрока, чтобы включить поле для страны
  // Заменяем блок с формой добавления игрока
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
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
              <div className="flex gap-2">
                <Input
                  placeholder={t("players.countryAbbreviation")}
                  value={newPlayerCountry}
                  onChange={(e) => setNewPlayerCountry(e.target.value.toUpperCase())}
                  maxLength={3}
                  disabled={isAddingPlayer}
                  onKeyDown={(e) => e.key === "Enter" && !isAddingPlayer && handleAddPlayer()}
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
                          <Input
                            value={editedPlayerCountry}
                            onChange={(e) => setEditedPlayerCountry(e.target.value.toUpperCase())}
                            placeholder={t("players.countryAbbreviation")}
                            maxLength={3}
                            className="w-20"
                            disabled={isEditingPlayer}
                          />
                        </div>
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
