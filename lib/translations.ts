export type Language = "ru" | "en" | "uk"

export const LANGUAGES: { [key in Language]: string } = {
  ru: "Русский",
  en: "English",
  uk: "Українська",
}

export type TranslationKeys = {
  common: {
    loading: string
    error: string
    save: string
    cancel: string
    delete: string
    edit: string
    back: string
    next: string
    submit: string
    offline: string
    online: string
    success: string
    warning: string
    add: string
    loadingPlayers: string
    fullscreen: string
    vmixOverlay: string
    vmixSettings: string
    checking: string
    saving: string
    continue: string
    updateSettings: string
    updateSettingsDesc: string
    settingsName: string
    settingsNamePlaceholder: string
    useAsDefault: string
    saveButton: string
    cancelButton: string
  }
  home: {
    title: string
    subtitle: string
    newMatch: string
    newMatchDesc: string
    tennis: string
    padel: string
    managePlayers: string
    activeMatches: string
    activeMatchesDesc: string
    matchHistory: string
    joinMatch: string
    joinMatchDesc: string
    joinByCode: string
    diagnostics: string
  }
  match: {
    score: string
    set: string
    game: string
    point: string
    player: string
    team: string
    teamA: string
    teamB: string
    serve: string
    undo: string
    settings: string
    scoreCard: string
    scoreControls: string
    addPoint: string
    switchServer: string
    switchSides: string
    leftSide: string
    rightSide: string
    needToSwitchSides: string
    management: string
    matchManagement: string
    editPlayers: string
    editTeams: string
    matchStatus: string
    matchType: string
    courtNumber: string
    completedMatch: string
    inProgressMatch: string
    deleteMatch: string
    confirmDeleteMatch: string
    deleteMatchWarning: string
    deleteMatchConfirm: string
    deleteMatchCancel: string
    matchDeleted: string
    matchDeleteError: string
    noCourtAssigned: string
    selectCourt: string
    courtAlreadyOccupied: string
    updateCourt: string
    courtUpdated: string
    courtUpdateError: string
    scoreEditing: string
    currentSet: string
    startTiebreakManually: string
    teamWonTiebreak: string
    matchCode: string
    scoringSystem: string
    classicScoring: string
    noAdScoring: string
    fast4Scoring: string
    tiebreakType: string
    regularTiebreak: string
    championshipTiebreak: string
    superTiebreak: string
    tiebreakAt: string
    selectTiebreakScore: string
    additional: string
    goldenGame: string
    goldenPoint: string
    windbreak: string
    applySettings: string
    unlockMatch: string
    endMatch: string
    confirmEndMatch: string
    finishMatch: string
    teamWonMatch: string
    serving: string
    currentGame: string
    editSets: string
    setXofY: string
    setX: string
    current: string
    tiebreak: string
    of: string
    fixedSides: string
    fixedPlayers: string
    toServe: string
    to: string
    loveAll: string
    play: string
  }
  scoreboard: {
    tennis: string
    padel: string
    singles: string
    doubles: string
    matchCompleted: string
    set: string
    of: string
    tiebreak: string
    game: string
    leftCourtSide: string
    rightCourtSide: string
    currentServer: string
    playerA: string
    playerB: string
  }
  scoreboardSettings: {
    title: string
    presets: string
    colors: string
    display: string
    sizes: string
    advancedColors: string
    darkTheme: string
    lightTheme: string
    contrastTheme: string
    neutralTheme: string
    backgroundColor: string
    textColor: string
    teamAColors: string
    teamBColors: string
    startColor: string
    endColor: string
    showCourtSides: string
    showCurrentServer: string
    showServerIndicator: string
    showSetsScore: string
    useCustomSizes: string
    fontSize: string
    playerCellWidth: string
    playerNamesFontSize: string
    gameScoreFontSize: string
    setsScoreFontSize: string
    infoBlockFontSize: string
    gameScoreTextColor: string
    gameCellBgColor: string
    tiebreakCellBgColor: string
    setsScoreTextColor: string
    done: string
  }
  matchPage: {
    loadingMatch: string
    errorTitle: string
    createNewMatch: string
    home: string
    court: string
    share: string
    viewScore: string
    notification: string
    matchTab: string
    exportImportTab: string
    exportMatch: string
    exportDescription: string
    exportButton: string
    importMatch: string
    importDescription: string
    importPlaceholder: string
    importButton: string
    technicalFunctions: string
    matchCode: string
    jsonCourt: string
    vmixCourt: string
    jsonMatch: string
    vmixMatch: string
    scoreUpdated: string
    linkCopied: string
    matchCodeCopied: string
    matchDataCopied: string
    importDataRequired: string
    matchImported: string
    importError: string
    matchDataSimplified: string
    backToMatchControl: string
  }
  matchList: {
    loading: string
    noMatches: string
    completed: string
    inProgress: string
    court: string
    code?: string
    error?: string
  }
  courtsList: {
    title: string
    description: string
    refresh: string
    court: string
    occupied: string
    available: string
  }
  supabaseStatus: {
    checking: string
    online: string
    offline: string
    checkingTooltip: string
    onlineTooltip: string
    offlineTooltip: string
    connectionInfo: string
    connectionDetails: string
    connectionEstablished: string
    connectionMissing: string
    checkNow: string
    connectionDetailsTitle: string
    possibleIssues: string
    issueInternet: string
    issueCredentials: string
    issueServer: string
    issueCors: string
    issueEnvVars: string
    close: string
  }
  players: {
    title: string
    addPlayer: string
    editPlayer: string
    deletePlayer: string
    deletePlayers: string
    deletePlayersConfirm: string
    deletePlayersWarning: string
    deleteSelected: string
    name: string
    country: string
    countryAbbreviation: string
    selectPlayer: string
    searchPlayer: string
    playerNotFound: string
    selectAll: string
    loadingPlayers: string
    emptyList: string
    totalPlayers: string
    selected: string
    errorAddingPlayer: string
    errorDeletingPlayers: string
    noPlayersFound: string
  }
  newMatch: {
    title: string
    tennisDesc: string
    padelDesc: string
    players: string
    player1: string
    player2: string
    team1Player1: string
    team1Player2: string
    team2Player1: string
    team2Player2: string
    createMatch: string
    matchSettings: string
    sets: string
    games: string
    tiebreak: string
    finalSetTiebreak: string
    finalSetTiebreakLength: string
    finalSetTiebreakLengthDescription: string
    finalSetTiebreakNote: string
    goldPoint: string
    goldenPoint: string
    goldenGame: string
    windbreak: string
    format: string
    selectFormat: string
    singles: string
    doubles: string
    oneSets: string
    twoSets: string
    threeSets: string
    fiveSets: string
    scoringSystem: string
    classicScoring: string
    noAdScoring: string
    fast4Scoring: string
    tiebreakType: string
    regularTiebreak: string
    championshipTiebreak: string
    superTiebreak: string
    tiebreakAt: string
    selectTiebreakScore: string
    additional: string
    firstServe: string
    teamASide: string
    left: string
    right: string
    courtSelection: string
    noCourt: string
    court: string
    checkingCourtAvailability: string
    occupiedCourts: string
    allCourtsAvailable: string
    startMatch: string
    selectAllPlayers: string
    selectAllPlayersForDoubles: string
    courtOccupied: string
    superSet: string
    matchRound: string
    selectMatchRound: string
    matchRounds: {
      none: string
      final: string
      semifinal: string
      quarterfinal: string
      round16: string
      round32: string
      round64: string
      round128: string
      qualificationFinal: string
      qualificationRound2: string
      qualificationRound1: string
      prequalifying: string
    }
  }
  vmixSettings: {
    title: string
    backToMatch: string
    settingsFor: string
    displaySettings: string
    apiForVmix: string
    basicSettings: string
    configureBasicParams: string
    theme: string
    selectTheme: string
    customTheme: string
    transparentTheme: string
    fontSize: string
    selectFontSize: string
    smallSize: string
    mediumSize: string
    largeSize: string
    xlargeSize: string
    playerNamesFontSize: string
    bgOpacity: string
    textColor: string
    serveIndicatorColor: string
    colorsAndGradients: string
    configureColorsAndGradients: string
    playerNamesBlock: string
    playerNamesBgColor: string
    useGradientForNames: string
    namesGradientStartColor: string
    namesGradientEndColor: string
    countriesBlock: string
    countriesBgColor: string
    useGradientForCountries: string
    countriesGradientStartColor: string
    countriesGradientEndColor: string
    serveIndicatorBlock: string
    serveIndicatorBgColor: string
    useGradientForServeIndicator: string
    serveIndicatorGradientStartColor: string
    serveIndicatorGradientEndColor: string
    serveIndicatorExample: string
    currentScoreBlock: string
    currentScoreBgColor: string
    useGradientForCurrentScore: string
    currentScoreGradientStartColor: string
    currentScoreGradientEndColor: string
    setsScoreBlock: string
    setsBgColor: string
    setsTextColor: string
    useGradientForSets: string
    setsGradientStartColor: string
    setsGradientEndColor: string
    importantMomentsIndicator: string
    indicatorBgColor: string
    indicatorTextColor: string
    useGradientForIndicator: string
    indicatorGradientStartColor: string
    indicatorGradientEndColor: string
    actions: string
    previewAndUseSettings: string
    preview: string
    openInNewWindow: string
    openInCurrentWindow: string
    copyUrl: string
    copying: string
    saveSettings: string
    jsonApiForVmix: string
    useApiForVmixData: string
    jsonApiUrl: string
    instructionsForVmix: string
    dataSourceSetup: string
    titleDesignerUsage: string
    titleDesignerSteps: string
    availableDataFields: string
    teamA: string
    teamB: string
    generalData: string
    dataFormatExample: string
    settingsSaved: string
    errorSavingSettings: string
    teamAName: string
    teamAScore: string
    teamAGameScore: string
    teamACurrentSet: string
    teamAServing: string
    teamASetScores: string
    teamBName: string
    teamBScore: string
    teamBGameScore: string
    teamBCurrentSet: string
    teamBServing: string
    teamBSetScores: string
    matchId: string
    isTiebreak: string
    isCompleted: string
    winner: string
    updateTime: string
    copyJsonApiUrl: string
    openCourtInNewWindow: string
    openCourtInCurrentWindow: string
    copyCourtUrl: string
    actionsForCourtPage: string
    courtNotAssigned: string
    selectSaveOrDeleteSettings: string
    saveSettingsDialog: string
    saveSettingsDescription: string
    settingsName: string
    settingsNamePlaceholder: string
    useAsDefault: string
    cancelButton: string
    savingButton: string
    saveButton: string
    savedSettings: string
    selectSettings: string
    small: string
    normal: string
    large: string
    xlarge: string
    playerNameBlock: string
    playerNameBgColor: string
    playerCountryBlock: string
    playerCountryBgColor: string
    useApiToGetMatchData: string
    goToSettingsDataSources: string
    clickAddAndSelectWeb: string
    pasteApiUrl: string
    setUpdateInterval: string
    clickOkToSave: string
    createOrOpenTitle: string
    addTextFields: string
    inTextFieldPropertiesSelectDataBinding: string
    selectDataSourceAndField: string
    repeatForAllFields: string
    urlCopied: string
    vmixUrlCopied: string
    courtUrlCopied: string
    jsonApiUrlCopied: string
    failedToCopyUrl: string
    openCourtPageNewWindow: string
    openCourtPageCurrentWindow: string
    copyCourtPageUrl: string
    matchNotAssignedToCourt: string
    loadingSettings: string
    backgroundOpacity: string
    accentColor: string
    previewWithCurrentSettings: string
    matchInfo: string
  }
  courtVmixSettings: {
    title: string
    backToMatch: string
    settingsForCourt: string
    noActiveMatches: string
    matchOnCourt: string
    displaySettings: string
    apiForVmix: string
    basicSettings: string
    configureBasicParams: string
    theme: string
    selectTheme: string
    customTheme: string
    transparentTheme: string
    fontSize: string
    selectFontSize: string
    smallSize: string
    mediumSize: string
    largeSize: string
    xlargeSize: string
    playerNamesFontSize: string
    bgOpacity: string
    textColor: string
    serveIndicatorColor: string
    colorsAndGradients: string
    configureColorsAndGradients: string
    playerNamesBlock: string
    playerNamesBgColor: string
    useGradientForNames: string
    namesGradientStartColor: string
    namesGradientEndColor: string
    countriesBlock: string
    countriesBgColor: string
    useGradientForCountries: string
    countriesGradientStartColor: string
    countriesGradientEndColor: string
    serveIndicatorBlock: string
    serveIndicatorBgColor: string
    useGradientForServeIndicator: string
    serveIndicatorGradientStartColor: string
    serveIndicatorGradientEndColor: string
    serveIndicatorExample: string
    currentScoreBlock: string
    currentScoreBgColor: string
    useGradientForCurrentScore: string
    currentScoreGradientStartColor: string
    currentScoreGradientEndColor: string
    setsScoreBlock: string
    setsBgColor: string
    setsTextColor: string
    useGradientForSets: string
    setsGradientStartColor: string
    setsGradientEndColor: string
    importantMomentsIndicator: string
    indicatorBgColor: string
    indicatorTextColor: string
    useGradientForIndicator: string
    indicatorGradientStartColor: string
    indicatorGradientEndColor: string
    actions: string
    previewAndUseSettings: string
    preview: string
    openInNewWindow: string
    openInCurrentWindow: string
    copyUrl: string
    copying: string
    saveSettings: string
    jsonApiForVmix: string
    useApiForVmixData: string
    jsonApiUrl: string
    instructionsForVmix: string
    dataSourceSetup: string
    dataSourceSteps: string
    titleDesignerUsage: string
    titleDesignerSteps: string
    availableDataFields: string
    teamA: string
    teamB: string
    generalData: string
    dataFormatExample: string
    settingsSaved: string
    errorSavingSettings: string
    loadingSettings: string
    teamAName: string
    teamAScore: string
    teamAGameScore: string
    teamACurrentSet: string
    teamAServing: string
    teamASetScores: string
    teamBName: string
    teamBScore: string
    teamBGameScore: string
    teamBCurrentSet: string
    teamBServing: string
    teamBSetScores: string
    matchId: string
    isTiebreak: string
    isCompleted: string
    winner: string
    updateTime: string
    copyJsonApiUrl: string
    showPlayerNames: string
    showCurrentPoints: string
    showSetsScore: string
    showServer: string
    showCountries: string
    savedSettings: string
    selectSaveOrDeleteSettings: string
    saveSettingsDialog: string
    saveSettingsDescription: string
    settingsName: string
    settingsNamePlaceholder: string
    useAsDefault: string
    cancelButton: string
    savingButton: string
    saveButton: string
    selectSettings: string
    createNewSettings: string
    updateSettings: string
    deleteSettings: string
    saveToDatabase: string
    deletingButton: string
    deleteButton: string
    deleteSettingsDialog: string
    deleteSettingsDescription: string
    matchInfo: string
  }
}

export const translations: { [key in Language]: TranslationKeys } = {
  ru: {
    common: {
      loading: "Загрузка...",
      error: "Ошибка",
      save: "Сохранить",
      cancel: "Отмена",
      delete: "Удалить",
      edit: "Редактировать",
      back: "Назад",
      next: "Далее",
      submit: "Отправить",
      offline: "Оффлайн",
      online: "Онлайн",
      success: "Успех",
      warning: "Предупреждение",
      add: "Добавить",
      loadingPlayers: "Загрузка игроков...",
      fullscreen: "Полный экран",
      vmixOverlay: "Vmix оверлей",
      vmixSettings: "Настройки Vmix",
      checking: "Проверка...",
      saving: "Сохранение...",
      continue: "Продолжить",
      updateSettings: "Обновить настройки",
      updateSettingsDesc: "Обновите существующие настройки",
      settingsName: "Название настроек",
      settingsNamePlaceholder: "Введите название настроек",
      useAsDefault: "Использовать как настройки по умолчанию",
      saveButton: "Сохранить",
      cancelButton: "Отмена",
    },
    home: {
      title: "Tennis & Padel Scoreboard",
      subtitle: "Отслеживайте счет в реальном времени",
      newMatch: "Создать новый матч",
      newMatchDesc: "Настройте новую игру с выбранными параметрами",
      tennis: "Теннис",
      padel: "Падел",
      managePlayers: "Управление игроками",
      activeMatches: "Активные матчи",
      activeMatchesDesc: "Текущие и недавние матчи",
      matchHistory: "История матчей",
      joinMatch: "Присоединиться к матчу",
      joinMatchDesc: "Введите код матча для просмотра",
      joinByCode: "Присоединиться по цифровому коду",
      diagnostics: "Диагностика",
    },
    match: {
      score: "Счет",
      set: "Сет",
      game: "Гейм",
      point: "Очко",
      player: "Игрок",
      team: "Команда",
      teamA: "Команда A",
      teamB: "Команда B",
      serve: "Подача",
      undo: "Отменить",
      settings: "Настройки",
      scoreCard: "Табло счета",
      scoreControls: "Управление счетом",
      addPoint: "Очко",
      switchServer: "Сменить подающего",
      switchSides: "Сменить стороны",
      leftSide: "Левая сторона",
      rightSide: "Правая сторона",
      needToSwitchSides:
        "Необходимо поменять стороны! Смена сторон произойдет автоматически при следующем изменении счета.",
      management: "Управление",
      matchManagement: "Управление матчем",
      editPlayers: "Редактировать игроков",
      editTeams: "Редактировать команды",
      matchStatus: "Статус матча",
      matchType: "Тип матча",
      courtNumber: "Номер корта",
      completedMatch: "Завершенный",
      inProgressMatch: "В процессе",
      deleteMatch: "Удалить матч",
      confirmDeleteMatch: "Подтвердите удаление",
      deleteMatchWarning: "Вы уверены, что хотите удалить этот матч? Это действие нельзя отменить.",
      deleteMatchConfirm: "Да, удалить",
      deleteMatchCancel: "Отмена",
      matchDeleted: "Матч успешно удален",
      matchDeleteError: "Ошибка при удалении матча",
      noCourtAssigned: "Не назначен",
      selectCourt: "Выберите корт",
      courtAlreadyOccupied: "Этот корт уже занят",
      updateCourt: "Обновить корт",
      courtUpdated: "Корт успешно обновлен",
      courtUpdateError: "Ошибка при обновлении корта",
      scoreEditing: "Редактирование счета",
      currentSet: "текущий",
      startTiebreakManually: "Начать тай-брейк вручную",
      teamWonTiebreak: "Тай-брейк выиграла",
      matchCode: "Код матча",
      scoringSystem: "Система счета",
      classicScoring: "Классическая (AD)",
      noAdScoring: "No-Ad (ровно → решающий мяч)",
      fast4Scoring: "Fast4 (до 4 геймов)",
      tiebreakType: "Тип тай-брейка",
      regularTiebreak: "Обычный (до 7)",
      championshipTiebreak: "Чемпионский (до 10)",
      superTiebreak: "Супер-тай-брейк (вместо 3-го сета)",
      tiebreakAt: "Тай-брейк при счете",
      selectTiebreakScore: "Выберите счет для тай-брейка",
      additional: "Дополнительно",
      goldenGame: "Золотой гейм (падел)",
      goldenPoint: "Золотой мяч (40-40 в решающем гейме)",
      windbreak: "Виндрейк (подача через гейм)",
      applySettings: "Применить настройки",
      unlockMatch: "Разблокировать матч",
      endMatch: "Завершить матч",
      confirmEndMatch: "Вы уверены, что хотите завершить матч? Вы сможете разблокировать его позже, если потребуется.",
      finishMatch: "Завершить матч",
      teamWonMatch: "{{team}} выиграли матч! Что вы хотите сделать?",
      serving: "Подача",
      currentGame: "Текущий гейм",
      editSets: "Редактирование счета в сетах",
      setXofY: "Сет {{current}} из {{total}}",
      setX: "Сет {{number}}",
      current: "Текущий",
      tiebreak: "Тай-брейк",
      of: "из",
      fixedSides: "Фиксированные стороны",
      fixedPlayers: "Фиксированные игроки",
      toServe: "подает",
      to: "на",
      loveAll: "ровно",
      play: "играйте",
    },
    scoreboard: {
      tennis: "Теннис",
      padel: "Падел",
      singles: "Одиночная игра",
      doubles: "Парная игра",
      matchCompleted: "Матч завершен",
      set: "Сет",
      of: "из",
      tiebreak: "Тайбрейк",
      game: "Гейм",
      leftCourtSide: "Левая сторона корта",
      rightCourtSide: "Правая сторона корта",
      currentServer: "Текущая подача",
      playerA: "Игрок A",
      playerB: "Игрок B",
    },
    scoreboardSettings: {
      title: "Настройки отображения",
      presets: "Готовые схемы",
      colors: "Цвета",
      display: "Отображение",
      sizes: "Размеры",
      advancedColors: "Доп. цвета",
      darkTheme: "Темная",
      lightTheme: "Светлая",
      contrastTheme: "Контрастная",
      neutralTheme: "Нейтральная",
      backgroundColor: "Цвет фона",
      textColor: "Цвет текста",
      teamAColors: "Цвета команды A",
      teamBColors: "Цвета команды B",
      startColor: "Начальный цвет",
      endColor: "Конечный цвет",
      showCourtSides: "Показывать стороны корта",
      showCurrentServer: "Показывать блок текущей подачи",
      showServerIndicator: "Показывать индикатор подачи у имен",
      showSetsScore: "Показывать счет сетов",
      useCustomSizes: "Использовать настройки размеров",
      fontSize: "Общий размер шрифта",
      playerCellWidth: "Ширина ячейки имен игроков",
      playerNamesFontSize: "Размер шрифта имен игроков",
      gameScoreFontSize: "Размер шрифта счета в гейме",
      setsScoreFontSize: "Размер шрифта счета в сетах",
      infoBlockFontSize: "Размер шрифта информационных блоков",
      gameScoreTextColor: "Цвет текста счета в гейме",
      gameCellBgColor: "Цвет фона ячейки гейма",
      tiebreakCellBgColor: "Цвет фона ячейки тай-брейка",
      setsScoreTextColor: "Цвет текста счета в сетах",
      done: "Готово",
    },
    matchPage: {
      loadingMatch: "Загрузка матча...",
      errorTitle: "Ошибка",
      createNewMatch: "Создать новый матч",
      home: "На главную",
      court: "Корт",
      share: "Поделиться",
      viewScore: "Просмотр счета",
      notification: "Уведомление",
      matchTab: "Матч",
      exportImportTab: "Экспорт/Импорт",
      exportMatch: "Экспорт матча",
      exportDescription: "Скопируйте данные матча для сохранения или передачи на другое устройство",
      exportButton: "Экспортировать данные",
      importMatch: "Импорт матча",
      importDescription: "Вставьте данные матча для импорта",
      importPlaceholder: "Вставьте данные матча в формате JSON",
      importButton: "Импортировать данные",
      technicalFunctions: "Технические функции",
      matchCode: "Код матча",
      jsonCourt: "JSON КОРТ",
      vmixCourt: "vMix корт",
      jsonMatch: "JSON МАТЧ",
      vmixMatch: "vMix матч",
      scoreUpdated: "Счет обновлен",
      linkCopied: "Ссылка скопирована в буфер обмена",
      matchCodeCopied: "Код матча скопирован в буфер обмена",
      matchDataCopied: "Данные матча скопированы в буфер обмена",
      importDataRequired: "Введите данные для импорта",
      matchImported: "Матч успешно импортирован",
      importError: "Ошибка при импорте матча. Проверьте формат данных.",
      matchDataSimplified: "Данные матча были упрощены из-за ограничений хранилища",
      backToMatchControl: "К управлению матчем",
    },
    matchList: {
      loading: "Загрузка матчей...",
      error: "Ошибка загрузки матчей",
      noMatches: "Нет активных матчей",
      court: "Корт",
      completed: "Завершен",
      inProgress: "В процессе",
      code: "Код",
      showingLatest: "Показаны последние {{count}} матчей",
    },
    courtsList: {
      title: "Статус кортов",
      description: "Информация о занятых кортах",
      refresh: "Обновить",
      court: "Корт",
      occupied: "Занят",
      available: "Свободен",
      jsonData: "JSON данные",
    },
    supabaseStatus: {
      checking: "Проверка...",
      online: "Онлайн",
      offline: "Офлайн",
      checkingTooltip: "Проверка соединения с базой данных...",
      onlineTooltip: "Синхронизация включена. Матчи доступны на всех устройствах.",
      offlineTooltip: "Синхронизация отключена. Матчи сохраняются только локально.",
      connectionInfo: "Информация о соединении с базой данных",
      connectionDetails: "Подробная информация о статусе соединения с Supabase",
      connectionEstablished: "Соединение установлено",
      connectionMissing: "Соединение отсутствует",
      checkNow: "Проверить сейчас",
      connectionDetailsTitle: "Детали соединения:",
      possibleIssues: "Возможные причины проблем с соединением:",
      issueInternet: "Отсутствует подключение к интернету",
      issueCredentials: "Неверные учетные данные Supabase",
      issueServer: "Сервер Supabase недоступен",
      issueCors: "Проблемы с CORS или сетевыми настройками",
      issueEnvVars: "Отсутствуют необходимые переменные окружения",
      close: "Закрыть",
    },
    players: {
      title: "Управление игроками",
      addPlayer: "Добавить игрока",
      editPlayer: "Редактировать игрока",
      deletePlayer: "Удалить игрока",
      deletePlayers: "Удаление игроков",
      deletePlayersConfirm: "Вы уверены, что хотите удалить выбранных игроков",
      deletePlayersWarning: "Это действие нельзя отменить.",
      deleteSelected: "Удалить выбранных",
      name: "Имя",
      country: "Страна",
      countryAbbreviation: "Аббревиатура страны (ENG, RUS, ESP...)",
      selectPlayer: "Выберите игрока",
      searchPlayer: "Поиск игрока...",
      playerNotFound: "Игрок не найден",
      selectAll: "Выбрать всех",
      loadingPlayers: "Загрузка игроков...",
      emptyList: "Список игроков пуст",
      totalPlayers: "Всего игроков",
      selected: "Выбрано",
      errorAddingPlayer: "Произошла ошибка при добавлении игрока",
      errorDeletingPlayers: "Произошла ошибка при удалении игроков",
      noPlayersFound: "Игроки не найдены",
    },
    newMatch: {
      title: "Создание нового матча",
      tennisDesc: "Настройка теннисного матча",
      padelDesc: "Настройка матча по паделу",
      players: "Игроки",
      player1: "Игрок 1",
      player2: "Игрок 2",
      team1Player1: "Команда 1 - Игрок 1",
      team1Player2: "Команда 1 - Игрок 2",
      team2Player1: "Команда 2 - Игрок 1",
      team2Player2: "Команда 2 - Игрок 2",
      createMatch: "Создать матч",
      matchSettings: "Настройки матча",
      sets: "Количество сетов",
      games: "Геймов в сете",
      tiebreak: "Тай-брейк",
      finalSetTiebreak: "Тай-брейк в решающем сете",
      finalSetTiebreakLength: "Длина тай-брейка в решающем сете",
      finalSetTiebreakLengthDescription: "Выберите длину тай-брейка в решающем сете",
      finalSetTiebreakNote: "Эта настройка влияет только на завершающий сет и не связана с обычными тайбрейками.",
      goldPoint: "Золотое очко",
      goldenPoint: "Золотое очко",
      goldenGame: "Золотой гейм (падел)",
      windbreak: "Виндрейк (подача через гейм)",
      format: "Формат игры",
      selectFormat: "Выберите формат",
      singles: "Одиночная игра",
      doubles: "Парная игра",
      oneSets: "1 сет",
      twoSets: "2 сета (тай-брейк в 3-м)",
      threeSets: "3 сета",
      fiveSets: "5 сетов (Гранд-слам)",
      scoringSystem: "Система счета",
      classicScoring: "Классическая (AD)",
      noAdScoring: "No-Ad (ровно → решающий мяч)",
      fast4Scoring: "Fast4 (до 4 геймов)",
      tiebreakType: "Тип тай-брейка",
      regularTiebreak: "Обычный (до 7)",
      championshipTiebreak: "Чемпионский (до 10)",
      superTiebreak: "Супер-тай-брейк (вместо 3-го сета)",
      tiebreakAt: "Тай-брейк при счете",
      selectTiebreakScore: "Выберите счет для тай-брейка",
      additional: "Дополнительно",
      firstServe: "Первая подача",
      teamASide: "Сторона команды A",
      left: "Левая",
      right: "Правая",
      courtSelection: "Выбор корта",
      noCourt: "Без корта",
      court: "Корт",
      checkingCourtAvailability: "Проверка доступности кортов...",
      occupiedCourts: "Занятые корты",
      allCourtsAvailable: "Все корты свободны",
      startMatch: "Начать матч",
      selectAllPlayers: "Выберите игроков для обеих команд",
      selectAllPlayersForDoubles: "Для парной игры необходимо выбрать всех игроков",
      courtOccupied: "Корт {{court}} уже занят. Выберите другой корт.",
      superSet: "ПРО сет до 8 геймов",
      matchRound: "Раунд матча",
      selectMatchRound: "Выберите раунд матча",
      matchRounds: {
        none: "Не выбрано",
        final: "Финал",
        semifinal: "Полуфинал",
        quarterfinal: "Четвертьфинал",
        round16: "1/8 финала",
        round32: "1/16 финала",
        round64: "1/32 финала",
        round128: "1/64 финала",
        qualificationFinal: "Финал квалификации",
        qualificationRound2: "Квалификация, раунд 2",
        qualificationRound1: "Квалификация, раунд 1",
        prequalifying: "Пре-квалификация",
      },
    },
    vmixSettings: {
      title: "Настройки vMix для матча",
      backToMatch: "Назад к матчу",
      settingsFor: "Настройки для матча",
      displaySettings: "Настройки отображения",
      apiForVmix: "API для vMix",
      basicSettings: "Основные настройки",
      configureBasicParams: "Настройте основные параметры отображения",
      theme: "Тема",
      selectTheme: "Выберите тему",
      customTheme: "Пользовательская",
      transparentTheme: "Прозрачная",
      fontSize: "Размер шрифта",
      selectFontSize: "Выберите размер шрифта",
      smallSize: "Маленький",
      mediumSize: "Средний",
      largeSize: "Большой",
      xlargeSize: "Очень большой",
      playerNamesFontSize: "Размер шрифта имен игроков",
      bgOpacity: "Прозрачность фона",
      textColor: "Цвет текста",
      serveIndicatorColor: "Цвет индикатора подачи",
      colorsAndGradients: "Цвета и градиенты",
      configureColorsAndGradients: "Настройте цвета и градиенты для различных блоков",
      playerNamesBlock: "Блок имен игроков",
      playerNamesBgColor: "Цвет фона имен игроков",
      useGradientForNames: "Использовать градиент для имен",
      namesGradientStartColor: "Начальный цвет градиента имен",
      namesGradientEndColor: "Конечный цвет градиента имен",
      countriesBlock: "Блок стран игроков",
      countriesBgColor: "Цвет фона стран игроков",
      useGradientForCountries: "Использовать градиент для стран",
      countriesGradientStartColor: "Начальный цвет градиента стран",
      countriesGradientEndColor: "Конечный цвет градиента стран",
      serveIndicatorBlock: "Блок индикатора подачи",
      serveIndicatorBgColor: "Цвет фона индикатора подачи",
      useGradientForServeIndicator: "Использовать градиент для фона индикатора подачи",
      serveIndicatorGradientStartColor: "Начальный цвет градиента фона индикатора",
      serveIndicatorGradientEndColor: "Конечный цвет градиента фона индикатора",
      serveIndicatorExample: "Пример индикатора подачи",
      currentScoreBlock: "Блок текущего счета",
      currentScoreBgColor: "Цвет фона текущего счета",
      useGradientForCurrentScore: "Использовать градиент для счета",
      currentScoreGradientStartColor: "Начальный цвет градиента счета",
      currentScoreGradientEndColor: "Конечный цвет градиента счета",
      setsScoreBlock: "Блок счета в сетах",
      setsBgColor: "Цвет фона счета сетов",
      setsTextColor: "Цвет текста счета сетов",
      useGradientForSets: "Использовать градиент для счета в сетах",
      setsGradientStartColor: "Начальный цвет градиента счета в сетах",
      setsGradientEndColor: "Конечный цвет градиента счета в сетах",
      importantMomentsIndicator: "Индикатор важных моментов",
      indicatorBgColor: "Цвет фона индикатора",
      indicatorTextColor: "Цвет текста индикатора",
      useGradientForIndicator: "Использовать градиент для индикатора",
      indicatorGradientStartColor: "Начальный цвет градиента индикатора",
      indicatorGradientEndColor: "Конечный цвет градиента индикатора",
      actions: "Действия",
      previewAndUseSettings: "Предпросмотр и использование настроек",
      preview: "Предпросмотр с текущими настройками",
      openInNewWindow: "Открыть в новом окне",
      openInCurrentWindow: "Открыть в текущем окне",
      copyUrl: "Скопировать URL",
      copying: "Копирование...",
      saveSettings: "Сохранить настройки",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Используйте этот API для получения данных матча в формате JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Инструкция по использованию в vMix",
      dataSourceSetup: "Настройка Data Source в vMix:",
      titleDesignerUsage: "Использование в Title Designer:",
      titleDesignerSteps:
        'В vMix, перейдите к "Settings" → "Data Sources"\nНажмите "Add" и выберите "Web"\nВставьте URL API в поле "URL"\nУстановите "Update Interval" на 1-2 секунды\nНажмите "OK" для сохранения',
      availableDataFields: "Доступные поля данных",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Общие данные:",
      dataFormatExample: "Пример формата данных",
      settingsSaved: "Настройки сохранены",
      errorSavingSettings: "Не удалось сохранить настройки",
      teamAName: "Имя команды A",
      teamAScore: "Счет команды A",
      teamAGameScore: "Текущий счет в гейме команды A",
      teamACurrentSet: "Текущий сет команды A",
      teamAServing: "Подача команды A",
      teamASetScores: "Счет в сетах команды A",
      teamBName: "Имя команды B",
      teamBScore: "Счет команды B",
      teamBGameScore: "Текущий счет в гейме команды B",
      teamBCurrentSet: "Текущий сет команды B",
      teamBServing: "Подача команды B",
      teamBSetScores: "Счет в сетах команды B",
      matchId: "ID матча",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершен",
      winner: "Победитель",
      updateTime: "Время обновления",
      copyJsonApiUrl: "Скопировать URL JSON API",
      openCourtInNewWindow: "Открыть корт в новом окне",
      openCourtInCurrentWindow: "Открыть корт в текущем окне",
      copyCourtUrl: "Скопировать URL корта",
      actionsForCourtPage: "Действия для страницы корта:",
      courtNotAssigned: "Матч не назначен на корт. Назначьте матч на корт, чтобы использовать эти функции.",
      selectSaveOrDeleteSettings: "Выберите, сохраните или удалите настройки vMix",
      saveSettingsDialog: "Сохранение настроек vMix",
      saveSettingsDescription: "Введите название для настроек и выберите, будут ли они использоваться по умолчанию",
      settingsName: "Название настроек",
      settingsNamePlaceholder: "Введите название настроек",
      useAsDefault: "Использовать по умолчанию",
      cancelButton: "Отмена",
      savingButton: "Сохранение...",
      saveButton: "Сохранить",
      savedSettings: "Сохраненные настройки",
      selectSettings: "Выберите настройки",
      small: "Маленький",
      normal: "Нормальный",
      large: "Большой",
      xlarge: "Очень большой",
      playerNameBlock: "Блок имен игроков",
      playerNameBgColor: "Цвет фона имен игроков",
      playerCountryBlock: "Блок стран игроков",
      playerCountryBgColor: "Цвет фона стран игроков",
      useApiToGetMatchData: "Используйте этот API для получения данных матча в формате JSON",
      goToSettingsDataSources: 'В vMix, перейдите к "Settings" → "Data Sources"',
      clickAddAndSelectWeb: 'Нажмите "Add" и выберите "Web"',
      pasteApiUrl: 'Вставьте URL API в поле "URL"',
      setUpdateInterval: 'Установите "Update Interval" на 1-2 секунды',
      clickOkToSave: 'Нажмите "OK" для сохранения',
      createOrOpenTitle: "Создайте новый Title или откройте существующий",
      addTextFields: "Добавьте текстовые поля для отображения данных",
      inTextFieldPropertiesSelectDataBinding: 'В свойствах текстового поля выберите "Data Binding"',
      selectDataSourceAndField: 'Выберите вашу Data Source и нужное поле (например, "teamA_name")',
      repeatForAllFields: "Повторите для всех нужных полей",
      urlCopied: "URL скопирован",
      vmixUrlCopied: "URL для vMix скопирован в буфер обмена",
      courtUrlCopied: "URL для корта скопирован в буфер обмена",
      jsonApiUrlCopied: "URL для JSON API скопирован в буфер обмена",
      failedToCopyUrl: "Не удалось скопировать URL",
      openCourtPageNewWindow: "Открыть страницу корта {courtNumber} в новом окне",
      openCourtPageCurrentWindow: "Открыть страницу корта {courtNumber} в текущем окне",
      copyCourtPageUrl: "Скопировать URL страницы корта {courtNumber}",
      matchNotAssignedToCourt: "Матч не назначен на корт. Назначьте матч на корт, чтобы использовать эти функции.",
      loadingSettings: "Загрузка настроек...",
      backgroundOpacity: "Прозрачность фона",
      accentColor: "Цвет акцента",
      previewWithCurrentSettings: "Предпросмотр с текущими настройками",
      matchInfo: "Информация о матче",
    },
    courtVmixSettings: {
      title: "Настройки vMix для корта",
      backToMatch: "Назад",
      settingsForCourt: "Настройки vMix для корта {number}",
      noActiveMatches: "Нет активных матчей на этом корте",
      matchOnCourt: "Матч на этом корте",
      displaySettings: "Настройки отображения",
      apiForVmix: "API для vMix",
      basicSettings: "Основные настройки",
      configureBasicParams: "Настройте основные параметры отображения",
      theme: "Тема",
      selectTheme: "Выберите тему",
      customTheme: "Пользовательская",
      transparentTheme: "Прозрачная",
      fontSize: "Размер шрифта",
      selectFontSize: "Выберите размер шрифта",
      smallSize: "Маленький",
      mediumSize: "Средний",
      largeSize: "Большой",
      xlargeSize: "Очень большой",
      playerNamesFontSize: "Размер шрифта имен игроков",
      bgOpacity: "Прозрачность фона",
      textColor: "Цвет текста",
      serveIndicatorColor: "Цвет индикатора подачи",
      colorsAndGradients: "Цвета и градиенты",
      configureColorsAndGradients: "Настройте цвета и градиенты для различных блоков",
      playerNamesBlock: "Блок имен игроков",
      playerNamesBgColor: "Цвет фона имен игроков",
      useGradientForNames: "Использовать градиент для имен",
      namesGradientStartColor: "Начальный цвет градиента имен",
      namesGradientEndColor: "Конечный цвет градиента имен",
      countriesBlock: "Блок стран игроков",
      countriesBgColor: "Цвет фона стран игроков",
      useGradientForCountries: "Использовать градиент для стран",
      countriesGradientStartColor: "Начальный цвет градиента стран",
      countriesGradientEndColor: "Конечный цвет градиента стран",
      serveIndicatorBlock: "Блок индикатора подачи",
      serveIndicatorBgColor: "Цвет фона индикатора подачи",
      useGradientForServeIndicator: "Использовать градиент для фона индикатора подачи",
      serveIndicatorGradientStartColor: "Начальный цвет градиента фона индикатора",
      serveIndicatorGradientEndColor: "Конечный цвет градиента фона индикатора",
      serveIndicatorExample: "Пример индикатора подачи",
      currentScoreBlock: "Блок текущего счета",
      currentScoreBgColor: "Цвет фона текущего счета",
      useGradientForCurrentScore: "Использовать градиент для счета",
      currentScoreGradientStartColor: "Начальный цвет градиента счета",
      currentScoreGradientEndColor: "Конечный цвет градиента счета",
      setsScoreBlock: "Блок счета в сетах",
      setsBgColor: "Цвет фона счета сетов",
      setsTextColor: "Цвет текста счета сетов",
      useGradientForSets: "Использовать градиент для счета в сетах",
      setsGradientStartColor: "Начальный цвет градиента счета в сетах",
      setsGradientEndColor: "Конечный цвет градиента счета в сетах",
      importantMomentsIndicator: "Индикатор важных моментов",
      indicatorBgColor: "Цвет фона индикатора",
      indicatorTextColor: "Цвет текста индикатора",
      useGradientForIndicator: "Использовать градиент для индикатора",
      indicatorGradientStartColor: "Начальный цвет градиента индикатора",
      indicatorGradientEndColor: "Конечный цвет градиента индикатора",
      actions: "Действия",
      previewAndUseSettings: "Предпросмотр и использование настроек",
      preview: "Предпросмотр с текущими настройками",
      openInNewWindow: "Открыть в новом окне",
      openInCurrentWindow: "Открыть в текущем окне",
      copyUrl: "Скопировать URL",
      copying: "Копирование...",
      saveSettings: "Сохранить настройки",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Используйте этот API для получения данных матча в формате JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Инструкция по использованию в vMix",
      dataSourceSetup: "Настройка Data Source в vMix:",
      dataSourceSteps: "Шаги настройки Data Source:",
      titleDesignerUsage: "Использование в Title Designer:",
      titleDesignerSteps:
        'В vMix, перейдите к "Settings" → "Data Sources"\nНажмите "Add" и выберите "Web"\nВставьте URL API в поле "URL"\nУстановите "Update Interval" на 1-2 секунды\nНажмите "OK" для сохранения',
      availableDataFields: "Доступные поля данных",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Общие данные:",
      dataFormatExample: "Пример формата данных",
      settingsSaved: "Настройки сохранены",
      errorSavingSettings: "Не удалось сохранить настройки",
      loadingSettings: "Загрузка настроек...",
      teamAName: "Имя команды A",
      teamAScore: "Счет команды A",
      teamAGameScore: "Текущий счет в гейме команды A",
      teamACurrentSet: "Текущий сет команды A",
      teamAServing: "Подача команды A",
      teamASetScores: "Счет в сетах команды A",
      teamBName: "Имя команды B",
      teamBScore: "Счет команды B",
      teamBGameScore: "Текущий счет в гейме команды B",
      teamBCurrentSet: "Текущий сет команды B",
      teamBServing: "Подача команды B",
      teamBSetScores: "Счет в сетах команды B",
      matchId: "ID матча",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершен",
      winner: "Победитель",
      updateTime: "Время обновления",
      copyJsonApiUrl: "Скопировать URL JSON API",
      showPlayerNames: "Показывать имена игроков",
      showCurrentPoints: "Показывать текущие очки",
      showSetsScore: "Показывать счет сетов",
      showServer: "Показывать подачу",
      showCountries: "Показывать страны",
      savedSettings: "Сохраненные настройки",
      selectSaveOrDeleteSettings: "Выберите, сохраните или удалите настройки vMix",
      saveSettingsDialog: "Сохранение настроек vMix",
      saveSettingsDescription: "Введите название для настроек и выберите, будут ли они использоваться по умолчанию",
      settingsName: "Название настроек",
      settingsNamePlaceholder: "Введите название настроек",
      useAsDefault: "Использовать по умолчанию",
      cancelButton: "Отмена",
      savingButton: "Сохранение...",
      saveButton: "Сохранить",
      selectSettings: "Выберите настройки",
      createNewSettings: "Создать новые настройки",
      updateSettings: "Обновить настройки",
      deleteSettings: "Удалить настройки",
      saveToDatabase: "Сохранить в базу данных",
      deletingButton: "Удаление...",
      deleteButton: "Удалить",
      deleteSettingsDialog: "Удаление настроек vMix",
      deleteSettingsDescription: "Вы уверены, что хотите удалить эти настройки?",
      matchInfo: "Информация о матче",
    },
  },
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      back: "Back",
      next: "Next",
      submit: "Submit",
      offline: "Offline",
      online: "Online",
      success: "Success",
      warning: "Warning",
      add: "Add",
      loadingPlayers: "Loading players...",
      fullscreen: "Fullscreen",
      vmixOverlay: "vMix overlay",
      vmixSettings: "vMix settings",
      checking: "Checking...",
      saving: "Saving...",
      continue: "Continue",
      updateSettings: "Update Settings",
      updateSettingsDesc: "Update existing settings",
      settingsName: "Settings Name",
      settingsNamePlaceholder: "Enter settings name",
      useAsDefault: "Use as default settings",
      saveButton: "Save",
      cancelButton: "Cancel",
    },
    home: {
      title: "Tennis & Padel Scoreboard",
      subtitle: "Track scores in real-time",
      newMatch: "Create new match",
      newMatchDesc: "Set up a new game with selected parameters",
      tennis: "Tennis",
      padel: "Padel",
      managePlayers: "Manage players",
      activeMatches: "Active matches",
      activeMatchesDesc: "Current and recent matches",
      matchHistory: "Match history",
      joinMatch: "Join match",
      joinMatchDesc: "Enter match code to view",
      joinByCode: "Join by code",
      diagnostics: "Diagnostics",
    },
    match: {
      score: "Score",
      set: "Set",
      game: "Game",
      point: "Point",
      player: "Player",
      team: "Team",
      teamA: "Team A",
      teamB: "Team B",
      serve: "Serve",
      undo: "Undo",
      settings: "Settings",
      scoreCard: "Scoreboard",
      scoreControls: "Score controls",
      addPoint: "Add point",
      switchServer: "Switch server",
      switchSides: "Switch sides",
      leftSide: "Left side",
      rightSide: "Right side",
      needToSwitchSides: "Need to switch sides! Side switch will happen automatically on the next score change.",
      management: "Management",
      matchManagement: "Match management",
      editPlayers: "Edit players",
      editTeams: "Edit teams",
      matchStatus: "Match status",
      matchType: "Match type",
      courtNumber: "Court number",
      completedMatch: "Completed",
      inProgressMatch: "In progress",
      deleteMatch: "Delete match",
      confirmDeleteMatch: "Confirm deletion",
      deleteMatchWarning: "Are you sure you want to delete this match? This action cannot be undone.",
      deleteMatchConfirm: "Yes, delete",
      deleteMatchCancel: "Cancel",
      matchDeleted: "Match successfully deleted",
      matchDeleteError: "Error deleting match",
      noCourtAssigned: "Not assigned",
      selectCourt: "Select court",
      courtAlreadyOccupied: "This court is already occupied",
      updateCourt: "Update court",
      courtUpdated: "Court successfully updated",
      courtUpdateError: "Error updating court",
      scoreEditing: "Score editing",
      currentSet: "current",
      startTiebreakManually: "Start tiebreak manually",
      teamWonTiebreak: "Team won tiebreak",
      matchCode: "Match code",
      scoringSystem: "Scoring system",
      classicScoring: "Classic (AD)",
      noAdScoring: "No-Ad (deuce → decisive point)",
      fast4Scoring: "Fast4 (up to 4 games)",
      tiebreakType: "Tiebreak type",
      regularTiebreak: "Regular (up to 7)",
      championshipTiebreak: "Championship (up to 10)",
      superTiebreak: "Super tiebreak (instead of 3rd set)",
      tiebreakAt: "Tiebreak at score",
      selectTiebreakScore: "Select tiebreak score",
      additional: "Additional",
      goldenGame: "Golden game (padel)",
      goldenPoint: "Golden point (40-40 in decisive game)",
      windbreak: "Windbreak (serve through game)",
      applySettings: "Apply settings",
      unlockMatch: "Unlock match",
      endMatch: "End match",
      confirmEndMatch: "Are you sure you want to end this match? You can unlock it later if needed.",
      finishMatch: "Finish match",
      teamWonMatch: "{{team}} won the match! What would you like to do?",
      serving: "Serving",
      currentGame: "Current game",
      editSets: "Edit sets score",
      setXofY: "Set {{current}} of {{total}}",
      setX: "Set {{number}}",
      current: "Current",
      tiebreak: "Tiebreak",
      of: "of",
      fixedSides: "Fixed sides",
      fixedPlayers: "Fixed players",
      toServe: "serves",
      to: "to",
      loveAll: "all love",
      play: "play",
    },
    scoreboard: {
      tennis: "Tennis",
      padel: "Padel",
      singles: "Singles",
      doubles: "Doubles",
      matchCompleted: "Match completed",
      set: "Set",
      of: "of",
      tiebreak: "Tiebreak",
      game: "Game",
      leftCourtSide: "Left court side",
      rightCourtSide: "Right court side",
      currentServer: "Current server",
      playerA: "Player A",
      playerB: "Player B",
    },
    scoreboardSettings: {
      title: "Display settings",
      presets: "Presets",
      colors: "Colors",
      display: "Display",
      sizes: "Sizes",
      advancedColors: "Advanced colors",
      darkTheme: "Dark",
      lightTheme: "Light",
      contrastTheme: "Contrast",
      neutralTheme: "Neutral",
      backgroundColor: "Background color",
      textColor: "Text color",
      teamAColors: "Team A colors",
      teamBColors: "Team B colors",
      startColor: "Start color",
      endColor: "End color",
      showCourtSides: "Show court sides",
      showCurrentServer: "Show current server block",
      showServerIndicator: "Show serve indicator next to names",
      showSetsScore: "Show sets score",
      useCustomSizes: "Use custom sizes",
      fontSize: "Font size",
      playerCellWidth: "Player name cell width",
      playerNamesFontSize: "Player names font size",
      gameScoreFontSize: "Game score font size",
      setsScoreFontSize: "Sets score font size",
      infoBlockFontSize: "Info block font size",
      gameScoreTextColor: "Game score text color",
      gameCellBgColor: "Game cell background color",
      tiebreakCellBgColor: "Tiebreak cell background color",
      setsScoreTextColor: "Sets score text color",
      done: "Done",
    },
    matchPage: {
      loadingMatch: "Loading match...",
      errorTitle: "Error",
      createNewMatch: "Create new match",
      home: "Back to home",
      court: "Court",
      share: "Share",
      viewScore: "View score",
      notification: "Notification",
      matchTab: "Match",
      exportImportTab: "Export/Import",
      exportMatch: "Export match",
      exportDescription: "Copy match data to save or transfer to another device",
      exportButton: "Export data",
      importMatch: "Import match",
      importDescription: "Paste match data to import",
      importPlaceholder: "Paste match data in JSON format",
      importButton: "Import data",
      technicalFunctions: "Technical functions",
      matchCode: "Match code",
      jsonCourt: "JSON COURT",
      vmixCourt: "vMix court",
      jsonMatch: "JSON MATCH",
      vmixMatch: "vMix match",
      scoreUpdated: "Score updated",
      linkCopied: "Link copied to clipboard",
      matchCodeCopied: "Match code copied to clipboard",
      matchDataCopied: "Match data copied to clipboard",
      importDataRequired: "Enter data to import",
      matchImported: "Match successfully imported",
      importError: "Error importing match. Check data format.",
      matchDataSimplified: "Match data was simplified due to storage limitations",
      backToMatchControl: "Back to match control",
    },
    matchList: {
      loading: "Loading matches...",
      error: "Error loading matches",
      noMatches: "No active matches",
      court: "Court",
      completed: "Completed",
      inProgress: "In progress",
      code: "Code",
      showingLatest: "Showing latest {{count}} matches",
    },
    courtsList: {
      title: "Courts status",
      description: "Information about occupied courts",
      refresh: "Refresh",
      court: "Court",
      occupied: "Occupied",
      available: "Available",
      jsonData: "JSON data",
    },
    supabaseStatus: {
      checking: "Checking...",
      online: "Online",
      offline: "Offline",
      checkingTooltip: "Checking database connection...",
      onlineTooltip: "Synchronization enabled. Matches are available on all devices.",
      offlineTooltip: "Synchronization disabled. Matches are saved locally only.",
      connectionInfo: "Database connection information",
      connectionDetails: "Detailed information about Supabase connection status",
      connectionEstablished: "Connection established",
      connectionMissing: "Connection missing",
      checkNow: "Check now",
      connectionDetailsTitle: "Connection details:",
      possibleIssues: "Possible reasons for connection issues:",
      issueInternet: "No internet connection",
      issueCredentials: "Incorrect Supabase credentials",
      issueServer: "Supabase server is unavailable",
      issueCors: "CORS or network settings issues",
      issueEnvVars: "Missing required environment variables",
      close: "Close",
    },
    players: {
      title: "Manage players",
      addPlayer: "Add player",
      editPlayer: "Edit player",
      deletePlayer: "Delete player",
      deletePlayers: "Delete players",
      deletePlayersConfirm: "Are you sure you want to delete selected players?",
      deletePlayersWarning: "This action cannot be undone.",
      deleteSelected: "Delete selected",
      name: "Name",
      country: "Country",
      countryAbbreviation: "Country abbreviation (ENG, RUS, ESP...)",
      selectPlayer: "Select player",
      searchPlayer: "Search player...",
      playerNotFound: "Player not found",
      selectAll: "Select all",
      loadingPlayers: "Loading players...",
      emptyList: "Player list is empty",
      totalPlayers: "Total players",
      selected: "Selected",
      errorAddingPlayer: "Error adding player",
      errorDeletingPlayers: "Error deleting players",
      noPlayersFound: "No players found",
    },
    newMatch: {
      title: "Create new match",
      tennisDesc: "Tennis match setup",
      padelDesc: "Padel match setup",
      players: "Players",
      player1: "Player 1",
      player2: "Player 2",
      team1Player1: "Team 1 - Player 1",
      team1Player2: "Team 1 - Player 2",
      team2Player1: "Team 2 - Player 1",
      team2Player2: "Team 2 - Player 2",
      createMatch: "Create match",
      matchSettings: "Match settings",
      sets: "Number of sets",
      games: "Games per set",
      tiebreak: "Tiebreak",
      finalSetTiebreak: "Tiebreak in the final set",
      finalSetTiebreakLength: "Length of tiebreak in the final set",
      finalSetTiebreakLengthDescription: "Select the length of tiebreak in the final set",
      finalSetTiebreakNote: "This setting affects only the final set and is not related to regular tiebreaks.",
      goldPoint: "Golden point",
      goldenPoint: "Golden point",
      goldenGame: "Golden game (padel)",
      windbreak: "Windbreak (serve through game)",
      format: "Game format",
      selectFormat: "Select format",
      singles: "Singles",
      doubles: "Doubles",
      oneSets: "1 set",
      twoSets: "2 sets (tiebreak in 3rd)",
      threeSets: "3 sets",
      fiveSets: "5 sets (Grand Slam)",
      scoringSystem: "Scoring system",
      classicScoring: "Classic (AD)",
      noAdScoring: "No-Ad (deuce → decisive point)",
      fast4Scoring: "Fast4 (up to 4 games)",
      tiebreakType: "Tiebreak type",
      regularTiebreak: "Regular (up to 7)",
      championshipTiebreak: "Championship (up to 10)",
      superTiebreak: "Super tiebreak (instead of 3rd set)",
      tiebreakAt: "Tiebreak at score",
      selectTiebreakScore: "Select tiebreak score",
      additional: "Additional",
      firstServe: "First serve",
      teamASide: "Team A side",
      left: "Left",
      right: "Right",
      courtSelection: "Court selection",
      noCourt: "No court",
      court: "Court",
      checkingCourtAvailability: "Checking court availability...",
      occupiedCourts: "Occupied courts",
      allCourtsAvailable: "All courts are available",
      startMatch: "Start match",
      selectAllPlayers: "Select players for both teams",
      selectAllPlayersForDoubles: "For doubles, select all players",
      courtOccupied: "Court {{court}} is already occupied. Select another court.",
      superSet: "SUPER set up to 8 games",
      matchRound: "Match round",
      selectMatchRound: "Select match round",
      matchRounds: {
        none: "None",
        final: "Final",
        semifinal: "Semifinal",
        quarterfinal: "Quarterfinal",
        round16: "Round of 16",
        round32: "Round of 32",
        round64: "Round of 64",
        round128: "Round of 128",
        qualificationFinal: "Qualification Final",
        qualificationRound2: "Qualification Round 2",
        qualificationRound1: "Qualification Round 1",
        prequalifying: "Prequalifying",
      },
    },
    vmixSettings: {
      title: "vMix settings for match",
      backToMatch: "Back to match",
      settingsFor: "Settings for match",
      displaySettings: "Display settings",
      apiForVmix: "API for vMix",
      basicSettings: "Basic settings",
      configureBasicParams: "Configure basic display parameters",
      theme: "Theme",
      selectTheme: "Select theme",
      customTheme: "Custom",
      transparentTheme: "Transparent",
      fontSize: "Font size",
      selectFontSize: "Select font size",
      smallSize: "Small",
      mediumSize: "Medium",
      largeSize: "Large",
      xlargeSize: "Extra large",
      playerNamesFontSize: "Player names font size",
      bgOpacity: "Background opacity",
      textColor: "Text color",
      serveIndicatorColor: "Serve indicator color",
      colorsAndGradients: "Colors and gradients",
      configureColorsAndGradients: "Configure colors and gradients for various blocks",
      playerNamesBlock: "Player names block",
      playerNamesBgColor: "Player names background color",
      useGradientForNames: "Use gradient for names",
      namesGradientStartColor: "Gradient start color for names",
      namesGradientEndColor: "Gradient end color for names",
      countriesBlock: "Countries block",
      countriesBgColor: "Countries background color",
      useGradientForCountries: "Use gradient for countries",
      countriesGradientStartColor: "Gradient start color for countries",
      countriesGradientEndColor: "Gradient end color for countries",
      serveIndicatorBlock: "Serve indicator block",
      serveIndicatorBgColor: "Serve indicator background color",
      useGradientForServeIndicator: "Use gradient for serve indicator background",
      serveIndicatorGradientStartColor: "Gradient start color for serve indicator background",
      serveIndicatorGradientEndColor: "Gradient end color for serve indicator background",
      serveIndicatorExample: "Serve indicator example",
      currentScoreBlock: "Current score block",
      currentScoreBgColor: "Current score background color",
      useGradientForCurrentScore: "Use gradient for current score",
      currentScoreGradientStartColor: "Gradient start color for current score",
      currentScoreGradientEndColor: "Gradient end color for current score",
      setsScoreBlock: "Sets score block",
      setsBgColor: "Sets score background color",
      setsTextColor: "Sets score text color",
      useGradientForSets: "Use gradient for sets score",
      setsGradientStartColor: "Gradient start color for sets score",
      setsGradientEndColor: "Gradient end color for sets score",
      importantMomentsIndicator: "Important moments indicator",
      indicatorBgColor: "Indicator background color",
      indicatorTextColor: "Indicator text color",
      useGradientForIndicator: "Use gradient for indicator",
      indicatorGradientStartColor: "Gradient start color for indicator",
      indicatorGradientEndColor: "Gradient end color for indicator",
      actions: "Actions",
      previewAndUseSettings: "Preview and use settings",
      preview: "Preview with current settings",
      openInNewWindow: "Open in new window",
      openInCurrentWindow: "Open in current window",
      copyUrl: "Copy URL",
      copying: "Copying...",
      saveSettings: "Save settings",
      jsonApiForVmix: "JSON API for vMix",
      useApiForVmixData: "Use this API to get match data in JSON format",
      jsonApiUrl: "JSON API URL",
      instructionsForVmix: "Instructions for vMix:",
      dataSourceSetup: "Data Source setup in vMix:",
      titleDesignerUsage: "Usage in Title Designer:",
      titleDesignerSteps:
        'In vMix, go to "Settings" → "Data Sources"\nClick "Add" and select "Web"\nPaste the API URL in the "URL" field\nSet "Update Interval" to 1-2 seconds\nClick "OK" to save',
      availableDataFields: "Available data fields",
      teamA: "Team A:",
      teamB: "Team B:",
      generalData: "General data:",
      dataFormatExample: "Data format example",
      settingsSaved: "Settings saved",
      errorSavingSettings: "Failed to save settings",
      teamAName: "Team A name",
      teamAScore: "Team A score",
      teamAGameScore: "Current game score for Team A",
      teamACurrentSet: "Current set for Team A",
      teamAServing: "Team A serving",
      teamASetScores: "Set scores for Team A",
      teamBName: "Team B name",
      teamBScore: "Team B score",
      teamBGameScore: "Current game score for Team B",
      teamBCurrentSet: "Current set for Team B",
      teamBServing: "Team B serving",
      teamBSetScores: "Set scores for Team B",
      matchId: "Match ID",
      isTiebreak: "Is tiebreak",
      isCompleted: "Match completed",
      winner: "Winner",
      updateTime: "Update time",
      copyJsonApiUrl: "Copy JSON API URL",
      openCourtInNewWindow: "Open court in new window",
      openCourtInCurrentWindow: "Open court in current window",
      copyCourtUrl: "Copy court URL",
      actionsForCourtPage: "Actions for court page:",
      courtNotAssigned: "Match is not assigned to a court. Assign a match to a court to use these functions.",
      selectSaveOrDeleteSettings: "Select, save, or delete vMix settings",
      saveSettingsDialog: "Save vMix settings",
      saveSettingsDescription: "Enter a name for the settings and choose if they should be used by default",
      settingsName: "Settings name",
      settingsNamePlaceholder: "Enter settings name",
      useAsDefault: "Use as default",
      cancelButton: "Cancel",
      savingButton: "Saving...",
      saveButton: "Save",
      savedSettings: "Saved settings",
      selectSettings: "Select settings",
      small: "Small",
      normal: "Normal",
      large: "Large",
      xlarge: "Extra large",
      playerNameBlock: "Player name block",
      playerNameBgColor: "Player name background color",
      playerCountryBlock: "Player country block",
      playerCountryBgColor: "Player country background color",
      useApiToGetMatchData: "Use this API to get match data in JSON format",
      goToSettingsDataSources: 'In vMix, go to "Settings" → "Data Sources"',
      clickAddAndSelectWeb: 'Click "Add" and select "Web"',
      pasteApiUrl: 'Paste the API URL in the "URL" field',
      setUpdateInterval: 'Set "Update Interval" to 1-2 seconds',
      clickOkToSave: 'Click "OK" to save',
      createOrOpenTitle: "Create a new Title or open an existing one",
      addTextFields: "Add text fields to display data",
      inTextFieldPropertiesSelectDataBinding: 'In text field properties, select "Data Binding"',
      selectDataSourceAndField: 'Select your Data Source and the appropriate field (e.g., "teamA_name")',
      repeatForAllFields: "Repeat for all necessary fields",
      urlCopied: "URL copied",
      vmixUrlCopied: "vMix URL copied to clipboard",
      courtUrlCopied: "Court URL copied to clipboard",
      jsonApiUrlCopied: "JSON API URL copied to clipboard",
      failedToCopyUrl: "Failed to copy URL",
      openCourtPageNewWindow: "Open court page {courtNumber} in new window",
      openCourtPageCurrentWindow: "Open court page {courtNumber} in current window",
      copyCourtPageUrl: "Copy court page {courtNumber} URL",
      matchNotAssignedToCourt: "Match is not assigned to a court. Assign a match to a court to use these functions.",
      loadingSettings: "Loading settings...",
      backgroundOpacity: "Background opacity",
      accentColor: "Accent color",
      previewWithCurrentSettings: "Preview with current settings",
      matchInfo: "Match information",
    },
    courtVmixSettings: {
      title: "vMix settings for court",
      backToMatch: "Back",
      settingsForCourt: "vMix settings for court {number}",
      noActiveMatches: "No active matches on this court",
      matchOnCourt: "Match on this court",
      displaySettings: "Display settings",
      apiForVmix: "API for vMix",
      basicSettings: "Basic settings",
      configureBasicParams: "Configure basic display parameters",
      theme: "Theme",
      selectTheme: "Select theme",
      customTheme: "Custom",
      transparentTheme: "Transparent",
      fontSize: "Font size",
      selectFontSize: "Select font size",
      smallSize: "Small",
      mediumSize: "Medium",
      largeSize: "Large",
      xlargeSize: "Extra large",
      playerNamesFontSize: "Player names font size",
      bgOpacity: "Background opacity",
      textColor: "Text color",
      serveIndicatorColor: "Serve indicator color",
      colorsAndGradients: "Colors and gradients",
      configureColorsAndGradients: "Configure colors and gradients for various blocks",
      playerNamesBlock: "Player names block",
      playerNamesBgColor: "Player names background color",
      useGradientForNames: "Use gradient for names",
      namesGradientStartColor: "Gradient start color for names",
      namesGradientEndColor: "Gradient end color for names",
      countriesBlock: "Countries block",
      countriesBgColor: "Countries background color",
      useGradientForCountries: "Use gradient for countries",
      countriesGradientStartColor: "Gradient start color for countries",
      countriesGradientEndColor: "Gradient end color for countries",
      serveIndicatorBlock: "Serve indicator block",
      serveIndicatorBgColor: "Serve indicator background color",
      useGradientForServeIndicator: "Use gradient for serve indicator background",
      serveIndicatorGradientStartColor: "Gradient start color for serve indicator background",
      serveIndicatorGradientEndColor: "Gradient end color for serve indicator background",
      serveIndicatorExample: "Serve indicator example",
      currentScoreBlock: "Current score block",
      currentScoreBgColor: "Current score background color",
      useGradientForCurrentScore: "Use gradient for current score",
      currentScoreGradientStartColor: "Gradient start color for current score",
      currentScoreGradientEndColor: "Gradient end color for current score",
      setsScoreBlock: "Sets score block",
      setsBgColor: "Sets score background color",
      setsTextColor: "Sets score text color",
      useGradientForSets: "Use gradient for sets score",
      setsGradientStartColor: "Gradient start color for sets score",
      setsGradientEndColor: "Gradient end color for sets score",
      importantMomentsIndicator: "Important moments indicator",
      indicatorBgColor: "Indicator background color",
      indicatorTextColor: "Indicator text color",
      useGradientForIndicator: "Use gradient for indicator",
      indicatorGradientStartColor: "Gradient start color for indicator",
      indicatorGradientEndColor: "Gradient end color for indicator",
      actions: "Actions",
      previewAndUseSettings: "Preview and use settings",
      preview: "Preview with current settings",
      openInNewWindow: "Open in new window",
      openInCurrentWindow: "Open in current window",
      copyUrl: "Copy URL",
      copying: "Copying...",
      saveSettings: "Save settings",
      jsonApiForVmix: "JSON API for vMix",
      useApiForVmixData: "Use this API to get match data in JSON format",
      jsonApiUrl: "JSON API URL",
      instructionsForVmix: "Instructions for vMix:",
      dataSourceSetup: "Data Source setup in vMix:",
      dataSourceSteps: "Data Source setup steps:",
      titleDesignerUsage: "Usage in Title Designer:",
      titleDesignerSteps:
        'In vMix, go to "Settings" → "Data Sources"\nClick "Add" and select "Web"\nPaste the API URL in the "URL" field\nSet "Update Interval" to 1-2 seconds\nClick "OK" to save',
      availableDataFields: "Available data fields",
      teamA: "Team A:",
      teamB: "Team B:",
      generalData: "General data:",
      dataFormatExample: "Data format example",
      settingsSaved: "Settings saved",
      errorSavingSettings: "Failed to save settings",
      loadingSettings: "Loading settings...",
      teamAName: "Team A name",
      teamAScore: "Team A score",
      teamAGameScore: "Current game score for Team A",
      teamACurrentSet: "Current set for Team A",
      teamAServing: "Team A serving",
      teamASetScores: "Set scores for Team A",
      teamBName: "Team B name",
      teamBScore: "Team B score",
      teamBGameScore: "Current game score for Team B",
      teamBCurrentSet: "Current set for Team B",
      teamBServing: "Team B serving",
      teamBSetScores: "Set scores for Team B",
      matchId: "Match ID",
      isTiebreak: "Is tiebreak",
      isCompleted: "Match completed",
      winner: "Winner",
      updateTime: "Update time",
      copyJsonApiUrl: "Copy JSON API URL",
      showPlayerNames: "Show player names",
      showCurrentPoints: "Show current points",
      showSetsScore: "Show sets score",
      showServer: "Show server",
      showCountries: "Show countries",
      savedSettings: "Saved settings",
      selectSaveOrDeleteSettings: "Select, save, or delete vMix settings",
      saveSettingsDialog: "Save vMix settings",
      saveSettingsDescription: "Enter a name for the settings and choose if they should be used by default",
      settingsName: "Settings name",
      settingsNamePlaceholder: "Enter settings name",
      useAsDefault: "Use as default",
      cancelButton: "Cancel",
      savingButton: "Saving...",
      saveButton: "Save",
      selectSettings: "Select settings",
      createNewSettings: "Create new settings",
      updateSettings: "Update settings",
      deleteSettings: "Delete settings",
      saveToDatabase: "Save to database",
      deletingButton: "Deleting...",
      deleteButton: "Delete",
      deleteSettingsDialog: "Delete vMix settings",
      deleteSettingsDescription: "Are you sure you want to delete these settings?",
      matchInfo: "Match information",
    },
  },
  uk: {
    common: {
      loading: "Завантаження...",
      error: "Помилка",
      save: "Зберегти",
      cancel: "Скасувати",
      delete: "Видалити",
      edit: "Редагувати",
      back: "Назад",
      next: "Далі",
      submit: "Відправити",
      offline: "Офлайн",
      online: "Онлайн",
      success: "Успіх",
      warning: "Попередження",
      add: "Додати",
      loadingPlayers: "Завантаження гравців...",
      fullscreen: "Повноекранний режим",
      vmixOverlay: "Vmix overlay",
      vmixSettings: "Vmix налаштування",
      checking: "Перевірка...",
      saving: "Збереження...",
      continue: "Продовжити",
      updateSettings: "Оновити налаштування",
      updateSettingsDesc: "Оновіть існуючі налаштування",
      settingsName: "Назва налаштувань",
      settingsNamePlaceholder: "Введіть назву налаштувань",
      useAsDefault: "Використовувати як налаштування за замовчуванням",
      saveButton: "Зберегти",
      cancelButton: "Скасувати",
    },
    home: {
      title: "Теніс & Падел Табло",
      subtitle: "Відстежуйте рахунок в реальному часі",
      newMatch: "Створити новий матч",
      newMatchDesc: "Налаштуйте нову гру з вибраними параметрами",
      tennis: "Теніс",
      padel: "Падел",
      managePlayers: "Управління гравцями",
      activeMatches: "Активні матчи",
      activeMatchesDesc: "Поточні та останні матчи",
      matchHistory: "Історія матчів",
      joinMatch: "Приєднатися до матчу",
      joinMatchDesc: "Введіть код матчу для перегляду",
      joinByCode: "Приєднатися за кодом",
      diagnostics: "Діагностика",
    },
    match: {
      score: "Рахунок",
      set: "Сет",
      game: "Гейм",
      point: "Очки",
      player: "Гравець",
      team: "Команда",
      teamA: "Команда A",
      teamB: "Команда B",
      serve: "Подача",
      undo: "Відмінити",
      settings: "Налаштування",
      scoreCard: "Табло рахунку",
      scoreControls: "Керування рахунком",
      addPoint: "Очки",
      switchServer: "Змінити подаючого",
      switchSides: "Змінити сторони",
      leftSide: "Ліва сторона",
      rightSide: "Права сторона",
      needToSwitchSides:
        "Необхідно змінити сторони! Зміна сторін здійсниться автоматично при наступному зміні рахунку.",
      management: "Управління",
      matchManagement: "Управління матчем",
      editPlayers: "Редагувати гравців",
      editTeams: "Редагувати команди",
      matchStatus: "Статус матчу",
      matchType: "Тип матчу",
      courtNumber: "Номер корту",
      completedMatch: "Завершений",
      inProgressMatch: "В процесі",
      deleteMatch: "Видалити матч",
      confirmDeleteMatch: "Підтвердіть видалення",
      deleteMatchWarning: "Ви впевнені, що хочете видалити цей матч? Цю дію не можна скасувати.",
      deleteMatchConfirm: "Так, видалити",
      deleteMatchCancel: "Скасувати",
      matchDeleted: "Матч успішно видалений",
      matchDeleteError: "Помилка при видаленні матчу",
      noCourtAssigned: "Не призначено",
      selectCourt: "Виберіть корт",
      courtAlreadyOccupied: "Цей корт вже зайнятий",
      updateCourt: "Оновити корт",
      courtUpdated: "Корт успішно оновлений",
      courtUpdateError: "Помилка при оновленні корту",
      scoreEditing: "Редагування рахунку",
      currentSet: "поточний",
      startTiebreakManually: "Почати тай-брейк вручну",
      teamWonTiebreak: "Тай-брейк вигравла",
      matchCode: "Код матчу",
      scoringSystem: "Система рахунку",
      classicScoring: "Класична (AD)",
      noAdScoring: "No-Ad (ровно → решающий мяч)",
      fast4Scoring: "Fast4 (до 4 геймов)",
      tiebreakType: "Тип тай-брейка",
      regularTiebreak: "Звичайний (до 7)",
      championshipTiebreak: "Чемпіонський (до 10)",
      superTiebreak: "Супер-тай-брейк (замість 3-го сета)",
      tiebreakAt: "Тай-брейк при рахунку",
      selectTiebreakScore: "Виберіть рахунок для тай-брейка",
      additional: "Додатково",
      goldenGame: "Золотий гейм (падел)",
      goldenPoint: "Золотий мяч (40-40 в решающем гейме)",
      windbreak: "Виндрейк (подача через гейм)",
      applySettings: "Застосувати налаштування",
      unlockMatch: "Розблокувати матч",
      endMatch: "Завершити матч",
      confirmEndMatch: "Ви впевнені, що хочете завершити матч? Ви зможете розблокувати його пізніше, якщо потрібно.",
      finishMatch: "Завершити матч",
      teamWonMatch: "{{team}} виграли матч! Що ви хочете зробити?",
      serving: "Подача",
      currentGame: "Поточний гейм",
      editSets: "Редагування рахунку в сетах",
      setXofY: "Сет {{current}} з {{total}}",
      setX: "Сет {{number}}",
      current: "Поточний",
      tiebreak: "Тай-брейк",
      of: "з",
      fixedSides: "Фіксовані сторони",
      fixedPlayers: "Фіксовані гравці",
      toServe: "подає",
      to: "на",
      loveAll: "ровно",
      play: "іграйте",
    },
    scoreboard: {
      tennis: "Теніс",
      padel: "Падел",
      singles: "Одиночна гра",
      doubles: "Парна гра",
      matchCompleted: "Матч завершений",
      set: "Сет",
      of: "з",
      tiebreak: "Тайбрейк",
      game: "Гейм",
      leftCourtSide: "Ліва сторона корту",
      rightCourtSide: "Права сторона корту",
      currentServer: "Поточна подача",
      playerA: "Гравець A",
      playerB: "Гравець B",
    },
    scoreboardSettings: {
      title: "Налаштування відображення",
      presets: "Попередньо налаштовані схеми",
      colors: "Кольори",
      display: "Відображення",
      sizes: "Розміри",
      advancedColors: "Додаткові кольори",
      darkTheme: "Темна",
      lightTheme: "Світла",
      contrastTheme: "Контрастна",
      neutralTheme: "Нейтральна",
      backgroundColor: "Колір фону",
      textColor: "Колір тексту",
      teamAColors: "Кольори команди A",
      teamBColors: "Кольори команди B",
      startColor: "Початковий колір",
      endColor: "Кінцевий колір",
      showCourtSides: "Показувати сторони корту",
      showCurrentServer: "Показувати блок поточної подачи",
      showServerIndicator: "Показувати індикатор подачи поруч з іменами",
      showSetsScore: "Показувати рахунок сетів",
      useCustomSizes: "Використовувати налаштовані розміри",
      fontSize: "Загальний розмір шрифту",
      playerCellWidth: "Ширина комірки імен гравців",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      gameScoreFontSize: "Розмір шрифту рахунку в геймі",
      setsScoreFontSize: "Розмір шрифту рахунку в сетах",
      infoBlockFontSize: "Розмір шрифту інформаційних блоків",
      gameScoreTextColor: "Колір тексту рахунку в геймі",
      gameCellBgColor: "Колір фону комірки гейму",
      tiebreakCellBgColor: "Колір фону комірки тай-брейка",
      setsScoreTextColor: "Колір тексту рахунку в сетах",
      done: "Готово",
    },
    matchPage: {
      loadingMatch: "Завантаження матчу...",
      errorTitle: "Помилка",
      createNewMatch: "Створити новий матч",
      home: "На головну",
      court: "Корт",
      share: "Поділитися",
      viewScore: "Перегляд рахунку",
      notification: "Повідомлення",
      matchTab: "Матч",
      exportImportTab: "Експорт/Імпорт",
      exportMatch: "Експорт матчу",
      exportDescription: "Скопіюйте дані матчу для збереження або передачі на інше пристроє",
      exportButton: "Експортувати дані",
      importMatch: "Імпорт матчу",
      importDescription: "Вставте дані матчу для імпорту",
      importPlaceholder: "Вставте дані матчу у форматі JSON",
      importButton: "Імпортувати дані",
      technicalFunctions: "Технічні функції",
      matchCode: "Код матчу",
      jsonCourt: "JSON КОРТ",
      vmixCourt: "vMix корт",
      jsonMatch: "JSON МАТЧ",
      vmixMatch: "vMix матч",
      scoreUpdated: "Рахунок оновлений",
      linkCopied: "Посилання скопійовано в буфер обміну",
      matchCodeCopied: "Код матчу скопійовано в буфер обміну",
      matchDataCopied: "Дані матчу скопійовано в буфер обміну",
      importDataRequired: "Введіть дані для імпорту",
      matchImported: "Матч успішно імпортовано",
      importError: "Помилка при імпорті матчу. Перевірте формат даних.",
      matchDataSimplified: "Дані матчу були спрощені через обмеження сховища",
      backToMatchControl: "До керування матчем",
    },
    matchList: {
      loading: "Завантаження матчів...",
      error: "Помилка завантаження матчів",
      noMatches: "Немає активних матчів",
      court: "Корт",
      completed: "Завершений",
      inProgress: "В процесі",
      code: "Код",
      showingLatest: "Показано останніх {{count}} матчів",
    },
    courtsList: {
      title: "Статус кортів",
      description: "Інформація про зайняті корти",
      refresh: "Оновити",
      court: "Корт",
      occupied: "Зайнятий",
      available: "Доступний",
      jsonData: "JSON дані",
    },
    supabaseStatus: {
      checking: "Перевірка...",
      online: "Онлайн",
      offline: "Офлайн",
      checkingTooltip: "Перевірка з'єднання з базою даних...",
      onlineTooltip: "Синхронізація увімкнена. Матчі доступні на всіх пристроях.",
      offlineTooltip: "Синхронізація вимкнена. Матчі зберігаються лише локально.",
      connectionInfo: "Інформація про з'єднання з базою даних",
      connectionDetails: "Детальні інформації про статус з'єднання з Supabase",
      connectionEstablished: "З'єднання встановлене",
      connectionMissing: "З'єднання відсутнє",
      checkNow: "Перевірити зараз",
      connectionDetailsTitle: "Деталі з'єднання:",
      possibleIssues: "Можливі причини проблем з з'єднанням:",
      issueInternet: "Відсутнє з'єднання з інтернетом",
      issueCredentials: "Невірні облікові дані Supabase",
      issueServer: "Сервер Supabase недоступний",
      issueCors: "Проблеми з CORS або мережевими налаштуваннями",
      issueEnvVars: "Відсутні необхідні змінні середовища",
      close: "Закрити",
    },
    players: {
      title: "Управління гравцями",
      addPlayer: "Додати гравця",
      editPlayer: "Редагувати гравця",
      deletePlayer: "Видалити гравця",
      deletePlayers: "Видалення гравців",
      deletePlayersConfirm: "Ви впевнені, що хочете видалити вибраних гравців?",
      deletePlayersWarning: "Цю дію не можна скасувати.",
      deleteSelected: "Видалити вибрані",
      name: "Ім'я",
      country: "Країна",
      countryAbbreviation: "Абревіатура країни (ENG, RUS, ESP...)",
      selectPlayer: "Виберіть гравця",
      searchPlayer: "Пошук гравця...",
      playerNotFound: "Гравець не знайдений",
      selectAll: "Вибрати всіх",
      loadingPlayers: "Завантаження гравців...",
      emptyList: "Список гравців порожній",
      totalPlayers: "Всього гравців",
      selected: "Вибрано",
      errorAddingPlayer: "Виникла помилка при додаванні гравця",
      errorDeletingPlayers: "Виникла помилка при видаленні гравців",
      noPlayersFound: "Гравців не знайдено",
    },
    newMatch: {
      title: "Створення нового матчу",
      tennisDesc: "Налаштування тенісного матчу",
      padelDesc: "Налаштування матчу по паделу",
      players: "Гравці",
      player1: "Гравець 1",
      player2: "Гравець 2",
      team1Player1: "Команда 1 - Гравець 1",
      team1Player2: "Команда 1 - Гравець 2",
      team2Player1: "Команда 2 - Гравець 1",
      team2Player2: "Команда 2 - Гравець 2",
      createMatch: "Створити матч",
      matchSettings: "Налаштування матчу",
      sets: "Кількість сетів",
      games: "Геймів в сеті",
      tiebreak: "Тай-брейк",
      finalSetTiebreak: "Тай-брейк в решающем сете",
      finalSetTiebreakLength: "Довжина тай-брейка в решающем сете",
      finalSetTiebreakLengthDescription: "Виберіть довжину тай-брейка в решающем сете",
      finalSetTiebreakNote: "Ця налаштування впливає лише на завершальний сет і не пов'язана з звичайними тайбрейками.",
      goldPoint: "Золотий очок",
      goldenPoint: "Золотий очок",
      goldenGame: "Золотий гейм (падел)",
      windbreak: "Виндрейк (подача через гейм)",
      format: "Формат гри",
      selectFormat: "Виберіть формат",
      singles: "Одиночна гра",
      doubles: "Парна гра",
      oneSets: "1 сет",
      twoSets: "2 сета (тай-брейк в 3-м)",
      threeSets: "3 сета",
      fiveSets: "5 сетів (Гранд-слам)",
      scoringSystem: "Система рахунку",
      classicScoring: "Класична (AD)",
      noAdScoring: "No-Ad (ровно → решающий мяч)",
      fast4Scoring: "Fast4 (до 4 геймов)",
      tiebreakType: "Тип тай-брейка",
      regularTiebreak: "Звичайний (до 7)",
      championshipTiebreak: "Чемпіонський (до 10)",
      superTiebreak: "Супер-тай-брейк (замість 3-го сета)",
      tiebreakAt: "Тай-брейк при рахунку",
      selectTiebreakScore: "Виберіть рахунок для тай-брейка",
      additional: "Додатково",
      firstServe: "Перша подача",
      teamASide: "Сторона команди A",
      left: "Ліва",
      right: "Права",
      courtSelection: "Вибір корту",
      noCourt: "Без корту",
      court: "Корт",
      checkingCourtAvailability: "Перевірка доступності кортів...",
      occupiedCourts: "Зайняті корти",
      allCourtsAvailable: "Всі корти доступні",
      startMatch: "Почати матч",
      selectAllPlayers: "Виберіть гравців для обох команд",
      selectAllPlayersForDoubles: "Для парної гри необхідно вибрати всіх гравців",
      courtOccupied: "Корт {{court}} вже зайнятий. Виберіть інший корт.",
      superSet: "ПРО сет до 8 геймів",
      matchRound: "Раунд матчу",
      selectMatchRound: "Виберіть раунд матчу",
      matchRounds: {
        none: "Не вибрано",
        final: "Фінал",
        semifinal: "Полуфінал",
        quarterfinal: "Четвертьфінал",
        round16: "1/8 фіналу",
        round32: "1/16 фіналу",
        round64: "1/32 фіналу",
        round128: "1/64 фіналу",
        qualificationFinal: "Фінал кваліфікації",
        qualificationRound2: "Кваліфікація, раунд 2",
        qualificationRound1: "Кваліфікація, раунд 1",
        prequalifying: "Пре-кваліфікація",
      },
    },
    vmixSettings: {
      title: "Налаштування vMix для матчу",
      backToMatch: "Назад до матчу",
      settingsFor: "Налаштування для матчу",
      displaySettings: "Налаштування відображення",
      apiForVmix: "API для vMix",
      basicSettings: "Основні налаштування",
      configureBasicParams: "Налаштуйте основні параметри відображення",
      theme: "Тема",
      selectTheme: "Виберіть тему",
      customTheme: "Користувацька",
      transparentTheme: "Прозрачна",
      fontSize: "Розмір шрифту",
      selectFontSize: "Виберіть розмір шрифту",
      smallSize: "Малий",
      mediumSize: "Середній",
      largeSize: "Великий",
      xlargeSize: "Дуже великий",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      bgOpacity: "Прозрачність фону",
      textColor: "Колір тексту",
      serveIndicatorColor: "Колір індикатора подачи",
      colorsAndGradients: "Кольори та градієнти",
      configureColorsAndGradients: "Налаштуйте кольори та градієнти для різних блоків",
      playerNamesBlock: "Блок імен гравців",
      playerNamesBgColor: "Колір фону імен гравців",
      useGradientForNames: "Використовувати градієнт для імен",
      namesGradientStartColor: "Початковий колір градієнту імен",
      namesGradientEndColor: "Кінцевий колір градієнту імен",
      countriesBlock: "Блок країн гравців",
      countriesBgColor: "Колір фону країн гравців",
      useGradientForCountries: "Використовувати градієнт для країн",
      countriesGradientStartColor: "Початковий колір градієнту країн",
      countriesGradientEndColor: "Кінцевий колір градієнту країн",
      serveIndicatorBlock: "Блок індикатора подачи",
      serveIndicatorBgColor: "Колір фону індикатора подачи",
      useGradientForServeIndicator: "Використовувати градієнт для фону індикатора подачи",
      serveIndicatorGradientStartColor: "Початковий колір градієнту фону індикатора",
      serveIndicatorGradientEndColor: "Кінцевий колір градієнту фону індикатора",
      serveIndicatorExample: "Приклад індикатора подачи",
      currentScoreBlock: "Блок поточного рахунку",
      currentScoreBgColor: "Колір фону поточного рахунку",
      useGradientForCurrentScore: "Використовувати градієнт для рахунку",
      currentScoreGradientStartColor: "Початковий колір градієнту рахунку",
      currentScoreGradientEndColor: "Кінцевий колір градієнту рахунку",
      setsScoreBlock: "Блок рахунку в сетах",
      setsBgColor: "Колір фону рахунку сетів",
      setsTextColor: "Колір тексту рахунку сетів",
      useGradientForSets: "Використовувати градієнт для рахунку в сетах",
      setsGradientStartColor: "Початковий колір градієнту рахунку в сетах",
      setsGradientEndColor: "Кінцевий колір градієнту рахунку в сетах",
      importantMomentsIndicator: "Індикатор важливих моментів",
      indicatorBgColor: "Колір фону індикатора",
      indicatorTextColor: "Колір тексту індикатора",
      useGradientForIndicator: "Використовувати градієнт для індикатора",
      indicatorGradientStartColor: "Початковий колір градієнту індикатора",
      indicatorGradientEndColor: "Кінцевий колір градієнту індикатора",
      actions: "Дії",
      previewAndUseSettings: "Перегляд та використання налаштувань",
      preview: "Перегляд з поточними налаштуваннями",
      openInNewWindow: "Відкрити в новому вікні",
      openInCurrentWindow: "Відкрити в поточному вікні",
      copyUrl: "Скопіювати URL",
      copying: "Копіювання...",
      saveSettings: "Зберегти налаштування",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Використовуйте цей API для отримання даних матчу у форматі JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Інструкції для використання в vMix",
      dataSourceSetup: "Налаштування Data Source в vMix:",
      titleDesignerUsage: "Використання в Title Designer:",
      titleDesignerSteps:
        'У vMix, перейдіть до "Settings" → "Data Sources"\nНатисніть "Add" і виберіть "Web"\nВставте URL API у поле "URL"\nВстановіть "Update Interval" на 1-2 секунди\nНатисніть "OK" для збереження',
      availableDataFields: "Доступні поля даних",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Загальні дані:",
      dataFormatExample: "Приклад формату даних",
      settingsSaved: "Налаштування збережені",
      errorSavingSettings: "Не вдалося зберегти налаштування",
      teamAName: "Ім'я команди A",
      teamAScore: "Рахунок команди A",
      teamAGameScore: "Поточний рахунок в геймі команди A",
      teamACurrentSet: "Поточний сет команди A",
      teamAServing: "Подача команди A",
      teamASetScores: "Рахунок в сетах команди A",
      teamBName: "Ім'я команди B",
      teamBScore: "Рахунок команди B",
      teamBGameScore: "Поточний рахунок в геймі команди B",
      teamBCurrentSet: "Поточний сет команди B",
      teamBServing: "Подача команди B",
      teamBSetScores: "Рахунок в сетах команди B",
      matchId: "ID матчу",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершений",
      winner: "Переможець",
      updateTime: "Час оновлення",
      copyJsonApiUrl: "Скопіювати URL JSON API",
      openCourtInNewWindow: "Відкрити корт в новому вікні",
      openCourtInCurrentWindow: "Відкрити корт в поточному вікні",
      copyCourtUrl: "Скопіювати URL корту",
      actionsForCourtPage: "Дії для сторінки корту:",
      courtNotAssigned: "Матч не призначено на корт. Призначте матч на корт, щоб використовувати ці функції.",
      selectSaveOrDeleteSettings: "Виберіть, збережіть або видаліть налаштування vMix",
      saveSettingsDialog: "Збереження налаштувань vMix",
      saveSettingsDescription:
        "Введіть назву для налаштувань і виберіть, чи вони будуть використовуватися за замовчуванням",
      settingsName: "Назва налаштувань",
      settingsNamePlaceholder: "Введіть назву налаштувань",
      useAsDefault: "Використовувати за замовчуванням",
      cancelButton: "Скасувати",
      savingButton: "Збереження...",
      saveButton: "Зберегти",
      savedSettings: "Збережені налаштування",
      selectSettings: "Виберіть налаштування",
      small: "Малий",
      normal: "Нормальний",
      large: "Великий",
      xlarge: "Дуже великий",
      playerNameBlock: "Блок імен гравців",
      playerNameBgColor: "Колір фону імен гравців",
      playerCountryBlock: "Блок країн гравців",
      playerCountryBgColor: "Колір фону країн гравців",
      useApiToGetMatchData: "Використовуйте цей API для отримання даних матчу у форматі JSON",
      goToSettingsDataSources: 'У vMix, перейдіть до "Settings" → "Data Sources"',
      clickAddAndSelectWeb: 'Натисніть "Add" і виберіть "Web"',
      pasteApiUrl: 'Вставте URL API у поле "URL"',
      setUpdateInterval: 'Встановіть "Update Interval" на 1-2 секунди',
      clickOkToSave: 'Натисніть "OK" для збереження',
      createOrOpenTitle: "Створіть новий Title або відкрийте існуючий",
      addTextFields: "Додайте текстові поля для відображення даних",
      inTextFieldPropertiesSelectDataBinding: 'У властивостях текстового поля виберіть "Data Binding"',
      selectDataSourceAndField: 'Виберіть вашу Data Source і потрібне поле (наприклад, "teamA_name")',
      repeatForAllFields: "Повторіть для всіх потрібних полів",
      urlCopied: "URL скопійовано",
      vmixUrlCopied: "URL для vMix скопійовано в буфер обміну",
      courtUrlCopied: "URL для корту скопійовано в буфер обміну",
      jsonApiUrlCopied: "URL для JSON API скопійовано в буфер обміну",
      failedToCopyUrl: "Не вдалося скопіювати URL",
      openCourtPageNewWindow: "Відкрити сторінку корту {courtNumber} в новому вікні",
      openCourtPageCurrentWindow: "Відкрити сторінку корту {courtNumber} в поточному вікні",
      copyCourtPageUrl: "Скопіювати URL сторінки корту {courtNumber}",
      matchNotAssignedToCourt: "Матч не призначено на корт. Призначте матч на корт, щоб використовувати ці функції.",
      loadingSettings: "Завантаження налаштувань...",
      backgroundOpacity: "Прозрачність фону",
      accentColor: "Колір акцента",
      previewWithCurrentSettings: "Перегляд з поточними налаштуваннями",
      matchInfo: "Інформація про матч",
    },
    courtVmixSettings: {
      title: "Налаштування vMix для корту",
      backToMatch: "Назад",
      settingsForCourt: "Налаштування vMix для корту {number}",
      noActiveMatches: "Немає активних матчів на цьому корті",
      matchOnCourt: "Матч на цьому корті",
      displaySettings: "Налаштування відображення",
      apiForVmix: "API для vMix",
      basicSettings: "Основні налаштування",
      configureBasicParams: "Налаштуйте основні параметри відображення",
      theme: "Тема",
      selectTheme: "Виберіть тему",
      customTheme: "Користувацька",
      transparentTheme: "Прозрачна",
      fontSize: "Розмір шрифту",
      selectFontSize: "Виберіть розмір шрифту",
      smallSize: "Малий",
      mediumSize: "Середній",
      largeSize: "Великий",
      xlargeSize: "Дуже великий",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      bgOpacity: "Прозрачність фону",
      textColor: "Колір тексту",
      serveIndicatorColor: "Колір індикатора подачи",
      colorsAndGradients: "Кольори та градієнти",
      configureColorsAndGradients: "Налаштуйте кольори та градієнти для різних блоків",
      playerNamesBlock: "Блок імен гравців",
      playerNamesBgColor: "Колір фону імен гравців",
      useGradientForNames: "Використовувати градієнт для імен",
      namesGradientStartColor: "Початковий колір градієнту імен",
      namesGradientEndColor: "Кінцевий колір градієнту імен",
      countriesBlock: "Блок країн гравців",
      countriesBgColor: "Колір фону країн гравців",
      useGradientForCountries: "Використовувати градієнт для країн",
      countriesGradientStartColor: "Початковий колір градієнту країн",
      countriesGradientEndColor: "Кінцевий колір градієнту країн",
      serveIndicatorBlock: "Блок індикатора подачи",
      serveIndicatorBgColor: "Колір фону індикатора подачи",
      useGradientForServeIndicator: "Використовувати градієнт для фону індикатора подачи",
      serveIndicatorGradientStartColor: "Початковий колір градієнту фону індикатора",
      serveIndicatorGradientEndColor: "Кінцевий колір градієнту фону індикатора",
      serveIndicatorExample: "Приклад індикатора подачи",
      currentScoreBlock: "Блок поточного рахунку",
      currentScoreBgColor: "Колір фону поточного рахунку",
      useGradientForCurrentScore: "Використовувати градієнт для рахунку",
      currentScoreGradientStartColor: "Початковий колір градієнту рахунку",
      currentScoreGradientEndColor: "Кінцевий колір градієнту рахунку",
      setsScoreBlock: "Блок рахунку в сетах",
      setsBgColor: "Колір фону рахунку сетів",
      setsTextColor: "Колір тексту рахунку сетів",
      useGradientForSets: "Використовувати градієнт для рахунку в сетах",
      setsGradientStartColor: "Початковий колір градієнту рахунку в сетах",
      setsGradientEndColor: "Кінцевий колір градієнту рахунку в сетах",
      importantMomentsIndicator: "Індикатор важливих моментів",
      indicatorBgColor: "Колір фону індикатора",
      indicatorTextColor: "Колір тексту індикатора",
      useGradientForIndicator: "Використовувати градієнт для індикатора",
      indicatorGradientStartColor: "Початковий колір градієнту індикатора",
      indicatorGradientEndColor: "Кінцевий колір градієнту індикатора",
      actions: "Дії",
      previewAndUseSettings: "Перегляд та використання налаштувань",
      preview: "Перегляд з поточними налаштуваннями",
      openInNewWindow: "Відкрити в новому вікні",
      openInCurrentWindow: "Відкрити в поточному вікні",
      copyUrl: "Скопіювати URL",
      copying: "Копіювання...",
      saveSettings: "Зберегти налаштування",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Використовуйте цей API для отримання даних матчу у форматі JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Інструкції для використання в vMix",
      dataSourceSetup: "Налаштування Data Source в vMix:",
      dataSourceSteps: "Кроки налаштування Data Source:",
      titleDesignerUsage: "Використання в Title Designer:",
      titleDesignerSteps:
        'У vMix, перейдіть до "Settings" → "Data Sources"\nНатисніть "Add" і виберіть "Web"\nВставте URL API у поле "URL"\nВстановіть "Update Interval" на 1-2 секунди\nНатисніть "OK" для збереження',
      availableDataFields: "Доступні поля даних",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Загальні дані:",
      dataFormatExample: "Приклад формату даних",
      settingsSaved: "Налаштування збережені",
      errorSavingSettings: "Не вдалося зберегти налаштування",
      loadingSettings: "Завантаження налаштувань...",
      teamAName: "Ім'я команди A",
      teamAScore: "Рахунок команди A",
      teamAGameScore: "Поточний рахунок в геймі команди A",
      teamACurrentSet: "Поточний сет команди A",
      teamAServing: "Подача команди A",
      teamASetScores: "Рахунок в сетах команди A",
      teamBName: "Ім'я команди B",
      teamBScore: "Рахунок команди B",
      teamBGameScore: "Поточний рахунок в геймі команди B",
      teamBCurrentSet: "Поточний сет команди B",
      teamBServing: "Подача команди B",
      teamBSetScores: "Рахунок в сетах команди B",
      matchId: "ID матчу",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершений",
      winner: "Переможець",
      updateTime: "Час оновлення",
      copyJsonApiUrl: "Скопіювати URL JSON API",
      showPlayerNames: "Показувати імена гравців",
      showCurrentPoints: "Показувати поточні очки",
      showSetsScore: "Показувати рахунок сетів",
      showServer: "Показувати подачу",
      showCountries: "Показувати країни",
      savedSettings: "Збережені налаштування",
      selectSaveOrDeleteSettings: "Виберіть, збережіть або видаліть налаштування vMix",
      saveSettingsDialog: "Збереження налаштувань vMix",
      saveSettingsDescription:
        "Введіть назву для налаштувань і виберіть, чи вони будуть використовуватися за замовчуванням",
      settingsName: "Назва налаштувань",
      settingsNamePlaceholder: "Введіть назву налаштувань",
      useAsDefault: "Використовувати за замовчуванням",
      cancelButton: "Скасувати",
      savingButton: "Збереження...",
      saveButton: "Зберегти",
      selectSettings: "Виберіть налаштування",
      createNewSettings: "Створити нові налаштування",
      updateSettings: "Оновити налаштування",
      deleteSettings: "Видалити налаштування",
      saveToDatabase: "Зберегти в базу даних",
      deletingButton: "Видалення...",
      deleteButton: "Видалити",
      deleteSettingsDialog: "Видалення налаштувань vMix",
      deleteSettingsDescription: "Ви впевнені, що хочете видалити ці налаштування?",
      matchInfo: "Інформація про матч",
    },
  },
}
