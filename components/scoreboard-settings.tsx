"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Settings, X, Check } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

// В начале файла, обновим предопределенные цветовые схемы
const colorSchemes = {
  dark: {
    background: "#000000",
    text: "#ffffff",
    teamA: {
      from: "#2563eb", // blue-600
      to: "#1e40af", // blue-800
    },
    teamB: {
      from: "#dc2626", // red-600
      to: "#991b1b", // red-800
    },
  },
  light: {
    background: "#ffffff",
    text: "#000000",
    teamA: {
      from: "#93c5fd", // blue-300
      to: "#3b82f6", // blue-500
    },
    teamB: {
      from: "#fca5a5", // red-300
      to: "#ef4444", // red-500
    },
  },
  contrast: {
    background: "#000000",
    text: "#ffffff",
    teamA: {
      from: "#eab308", // yellow-500
      to: "#a16207", // yellow-700
    },
    teamB: {
      from: "#a855f7", // purple-500
      to: "#7e22ce", // purple-700
    },
  },
  neutral: {
    background: "#1a1a1a",
    text: "#e0e0e0",
    teamA: {
      from: "#4b5563", // gray-600
      to: "#1f2937", // gray-800
    },
    teamB: {
      from: "#6b7280", // gray-500
      to: "#374151", // gray-700
    },
  },
}

export function ScoreboardSettings({ settings, onSettingsChange }) {
  const [showSettings, setShowSettings] = useState(false)
  const { t } = useLanguage()

  // Применение цветовой схемы
  const applyColorScheme = (scheme) => {
    onSettingsChange({
      ...settings,
      backgroundColor: colorSchemes[scheme].background,
      textColor: colorSchemes[scheme].text,
      teamAColorFrom: colorSchemes[scheme].teamA.from,
      teamAColorTo: colorSchemes[scheme].teamA.to,
      teamBColorFrom: colorSchemes[scheme].teamB.from,
      teamBColorTo: colorSchemes[scheme].teamB.to,
    })
  }

  // Функция для генерации градиентного стиля из цветов
  const getGradientStyle = (fromColor, toColor) => {
    return {
      background: `linear-gradient(to right, ${fromColor}, ${toColor})`,
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSettings(true)}
        className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
      >
        <Settings className="h-4 w-4 mr-1" />
        {t("match.settings")}
      </Button>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t("scoreboardSettings.title")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Tabs defaultValue="presets">
              <TabsList className="mb-4">
                <TabsTrigger value="presets">{t("scoreboardSettings.presets")}</TabsTrigger>
                <TabsTrigger value="colors">{t("scoreboardSettings.colors")}</TabsTrigger>
                <TabsTrigger value="display">{t("scoreboardSettings.display")}</TabsTrigger>
                <TabsTrigger value="sizes">{t("scoreboardSettings.sizes")}</TabsTrigger>
                <TabsTrigger value="advanced-colors">{t("scoreboardSettings.advancedColors")}</TabsTrigger>
              </TabsList>

              <TabsContent value="presets">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="p-4 h-auto flex flex-col items-center"
                    onClick={() => applyColorScheme("dark")}
                  >
                    <div className="w-full h-16 bg-black mb-2 rounded flex items-center justify-center">
                      <div
                        className="w-1/3 h-8 rounded"
                        style={getGradientStyle(colorSchemes.dark.teamA.from, colorSchemes.dark.teamA.to)}
                      ></div>
                      <div
                        className="w-1/3 h-8 rounded ml-2"
                        style={getGradientStyle(colorSchemes.dark.teamB.from, colorSchemes.dark.teamB.to)}
                      ></div>
                    </div>
                    <span>{t("scoreboardSettings.darkTheme")}</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="p-4 h-auto flex flex-col items-center"
                    onClick={() => applyColorScheme("light")}
                  >
                    <div className="w-full h-16 bg-white border mb-2 rounded flex items-center justify-center">
                      <div
                        className="w-1/3 h-8 rounded"
                        style={getGradientStyle(colorSchemes.light.teamA.from, colorSchemes.light.teamA.to)}
                      ></div>
                      <div
                        className="w-1/3 h-8 rounded ml-2"
                        style={getGradientStyle(colorSchemes.light.teamB.from, colorSchemes.light.teamB.to)}
                      ></div>
                    </div>
                    <span>{t("scoreboardSettings.lightTheme")}</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="p-4 h-auto flex flex-col items-center"
                    onClick={() => applyColorScheme("contrast")}
                  >
                    <div className="w-full h-16 bg-black mb-2 rounded flex items-center justify-center">
                      <div
                        className="w-1/3 h-8 rounded"
                        style={getGradientStyle(colorSchemes.contrast.teamA.from, colorSchemes.contrast.teamA.to)}
                      ></div>
                      <div
                        className="w-1/3 h-8 rounded ml-2"
                        style={getGradientStyle(colorSchemes.contrast.teamB.from, colorSchemes.contrast.teamB.to)}
                      ></div>
                    </div>
                    <span>{t("scoreboardSettings.contrastTheme")}</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="p-4 h-auto flex flex-col items-center"
                    onClick={() => applyColorScheme("neutral")}
                  >
                    <div className="w-full h-16 bg-gray-900 mb-2 rounded flex items-center justify-center">
                      <div
                        className="w-1/3 h-8 rounded"
                        style={getGradientStyle(colorSchemes.neutral.teamA.from, colorSchemes.neutral.teamA.to)}
                      ></div>
                      <div
                        className="w-1/3 h-8 rounded ml-2"
                        style={getGradientStyle(colorSchemes.neutral.teamB.from, colorSchemes.neutral.teamB.to)}
                      ></div>
                    </div>
                    <span>{t("scoreboardSettings.neutralTheme")}</span>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="colors">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="bg-color" className="block mb-2">
                      {t("scoreboardSettings.backgroundColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="bg-color"
                        value={settings.backgroundColor}
                        onChange={(e) => onSettingsChange({ ...settings, backgroundColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.backgroundColor}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="text-color" className="block mb-2">
                      {t("scoreboardSettings.textColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="text-color"
                        value={settings.textColor}
                        onChange={(e) => onSettingsChange({ ...settings, textColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.textColor}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="block mb-2 text-lg font-medium">{t("scoreboardSettings.teamAColors")}</Label>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="teamA-from-color" className="block mb-2">
                          {t("scoreboardSettings.startColor")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="teamA-from-color"
                            value={settings.teamAColorFrom || colorSchemes.dark.teamA.from}
                            onChange={(e) => onSettingsChange({ ...settings, teamAColorFrom: e.target.value })}
                            className="w-10 h-10 rounded"
                          />
                          <span>{settings.teamAColorFrom || colorSchemes.dark.teamA.from}</span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="teamA-to-color" className="block mb-2">
                          {t("scoreboardSettings.endColor")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="teamA-to-color"
                            value={settings.teamAColorTo || colorSchemes.dark.teamA.to}
                            onChange={(e) => onSettingsChange({ ...settings, teamAColorTo: e.target.value })}
                            className="w-10 h-10 rounded"
                          />
                          <span>{settings.teamAColorTo || colorSchemes.dark.teamA.to}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="h-10 rounded mb-4"
                      style={getGradientStyle(
                        settings.teamAColorFrom || colorSchemes.dark.teamA.from,
                        settings.teamAColorTo || colorSchemes.dark.teamA.to,
                      )}
                    ></div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="block mb-2 text-lg font-medium">{t("scoreboardSettings.teamBColors")}</Label>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="teamB-from-color" className="block mb-2">
                          {t("scoreboardSettings.startColor")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="teamB-from-color"
                            value={settings.teamBColorFrom || colorSchemes.dark.teamB.from}
                            onChange={(e) => onSettingsChange({ ...settings, teamBColorFrom: e.target.value })}
                            className="w-10 h-10 rounded"
                          />
                          <span>{settings.teamBColorFrom || colorSchemes.dark.teamB.from}</span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="teamB-to-color" className="block mb-2">
                          {t("scoreboardSettings.endColor")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="teamB-to-color"
                            value={settings.teamBColorTo || colorSchemes.dark.teamB.to}
                            onChange={(e) => onSettingsChange({ ...settings, teamBColorTo: e.target.value })}
                            className="w-10 h-10 rounded"
                          />
                          <span>{settings.teamBColorTo || colorSchemes.dark.teamB.to}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="h-10 rounded mb-4"
                      style={getGradientStyle(
                        settings.teamBColorFrom || colorSchemes.dark.teamB.from,
                        settings.teamBColorTo || colorSchemes.dark.teamB.to,
                      )}
                    ></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="display">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-court-sides">{t("scoreboardSettings.showCourtSides")}</Label>
                    <Switch
                      id="show-court-sides"
                      checked={settings.showCourtSides}
                      onCheckedChange={(checked) => onSettingsChange({ ...settings, showCourtSides: checked })}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-current-server">{t("scoreboardSettings.showCurrentServer")}</Label>
                    <Switch
                      id="show-current-server"
                      checked={settings.showCurrentServer}
                      onCheckedChange={(checked) => onSettingsChange({ ...settings, showCurrentServer: checked })}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-server-indicator">{t("scoreboardSettings.showServerIndicator")}</Label>
                    <Switch
                      id="show-server-indicator"
                      checked={settings.showServerIndicator !== false}
                      onCheckedChange={(checked) => onSettingsChange({ ...settings, showServerIndicator: checked })}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-sets-score">{t("scoreboardSettings.showSetsScore")}</Label>
                    <Switch
                      id="show-sets-score"
                      checked={settings.showSetsScore}
                      onCheckedChange={(checked) => onSettingsChange({ ...settings, showSetsScore: checked })}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sizes">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <Label htmlFor="use-custom-sizes">{t("scoreboardSettings.useCustomSizes")}</Label>
                    <Switch
                      id="use-custom-sizes"
                      checked={settings.useCustomSizes !== false}
                      onCheckedChange={(checked) => onSettingsChange({ ...settings, useCustomSizes: checked })}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>

                  {settings.useCustomSizes !== false && (
                    <>
                      <div>
                        <Label htmlFor="font-size" className="block mb-2">
                          {t("scoreboardSettings.fontSize")}: {settings.fontSize}%
                        </Label>
                        <Slider
                          id="font-size"
                          min={50}
                          max={200}
                          step={5}
                          value={[settings.fontSize]}
                          onValueChange={(value) => onSettingsChange({ ...settings, fontSize: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="player-cell-width" className="block mb-2">
                          {t("scoreboardSettings.playerCellWidth")}: {settings.playerCellWidth || 60}%
                        </Label>
                        <Slider
                          id="player-cell-width"
                          min={40}
                          max={80}
                          step={5}
                          value={[settings.playerCellWidth || 60]}
                          onValueChange={(value) => onSettingsChange({ ...settings, playerCellWidth: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="player-names-font-size" className="block mb-2">
                          {t("scoreboardSettings.playerNamesFontSize")}: {settings.playerNamesFontSize || 100}%
                        </Label>
                        <Slider
                          id="player-names-font-size"
                          min={30}
                          max={400}
                          step={5}
                          value={[settings.playerNamesFontSize || 100]}
                          onValueChange={(value) => onSettingsChange({ ...settings, playerNamesFontSize: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="game-score-font-size" className="block mb-2">
                          {t("scoreboardSettings.gameScoreFontSize")}: {settings.gameScoreFontSize || 100}%
                        </Label>
                        <Slider
                          id="game-score-font-size"
                          min={50}
                          max={200}
                          step={5}
                          value={[settings.gameScoreFontSize || 100]}
                          onValueChange={(value) => onSettingsChange({ ...settings, gameScoreFontSize: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="sets-score-font-size" className="block mb-2">
                          {t("scoreboardSettings.setsScoreFontSize")}: {settings.setsScoreFontSize || 100}%
                        </Label>
                        <Slider
                          id="sets-score-font-size"
                          min={50}
                          max={200}
                          step={5}
                          value={[settings.setsScoreFontSize || 100]}
                          onValueChange={(value) => onSettingsChange({ ...settings, setsScoreFontSize: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <Label htmlFor="info-block-font-size" className="block mb-2">
                          {t("scoreboardSettings.infoBlockFontSize")}: {settings.infoBlockFontSize || 100}%
                        </Label>
                        <Slider
                          id="info-block-font-size"
                          min={50}
                          max={200}
                          step={5}
                          value={[settings.infoBlockFontSize || 100]}
                          onValueChange={(value) => onSettingsChange({ ...settings, infoBlockFontSize: value[0] })}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced-colors">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="game-score-text-color" className="block mb-2">
                      {t("scoreboardSettings.gameScoreTextColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="game-score-text-color"
                        value={settings.gameScoreTextColor || "#ffcc00"}
                        onChange={(e) => onSettingsChange({ ...settings, gameScoreTextColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.gameScoreTextColor || "#ffcc00"}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="game-cell-bg-color" className="block mb-2">
                      {t("scoreboardSettings.gameCellBgColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="game-cell-bg-color"
                        value={settings.gameCellBgColor || "#333333"}
                        onChange={(e) => onSettingsChange({ ...settings, gameCellBgColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.gameCellBgColor || "#333333"}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="tiebreak-cell-bg-color" className="block mb-2">
                      {t("scoreboardSettings.tiebreakCellBgColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="tiebreak-cell-bg-color"
                        value={settings.tiebreakCellBgColor || "#663300"}
                        onChange={(e) => onSettingsChange({ ...settings, tiebreakCellBgColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.tiebreakCellBgColor || "#663300"}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="sets-score-text-color" className="block mb-2">
                      {t("scoreboardSettings.setsScoreTextColor")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="sets-score-text-color"
                        value={settings.setsScoreTextColor || "#ffffff"}
                        onChange={(e) => onSettingsChange({ ...settings, setsScoreTextColor: e.target.value })}
                        className="w-10 h-10 rounded"
                      />
                      <span>{settings.setsScoreTextColor || "#ffffff"}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowSettings(false)}>
                <Check className="h-4 w-4 mr-2" />
                {t("scoreboardSettings.done")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
