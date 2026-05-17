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
    enterFullscreen: string
    exitFullscreen: string
    continue: string
    updateSettings: string
    updateSettingsDesc: string
    settingsName: string
    settingsNamePlaceholder: string
    useAsDefault: string
    saveButton: string
    cancelButton: string
    courtStatus: {
      matchInProgress: string
      matchInProgressDescription: string
      noMatch: string
      noMatchDescription: string
      refresh: string
      continue: string
      finishMatch: string
      finishMatchButton: string
      finishMatchLink: string
      matchFinished: string
      finishMatchError: string
      matchFinishedDescription: string
      finishMatchErrorDescription: string
      managePlayers: string
      activeMatches: string
      activeMatchesDesc: string
      matchHistory: string
      joinMatch: string
      joinMatchDesc: string
      joinByCode: string
      diagnostics: string
    }
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
    windbreak: string
    applySettings: string
    unlockMatch: string
    endMatch: string
    confirmEndMatch: string
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
    finishMatch: string
    finishMatchButton: string
    finishMatchLink: string
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
    court: string
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
    sideChange: string
    sidesSwapped: string
    switchServer: string
    switchSides: string
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
    invalidMatchId: string
    matchNotFound: string
    matchNotFoundOrDeleted: string
    errorLoadingMatch: string
    shareMatchTitle: string
    shareMatchText: string
    returnToHome: string
    matchUpdateFailed: string
    matchIsOver: string
    finalTiebreak: string
    teamWonConfirm: string
    ruleChangeNoRestart: string
    ruleChangeAffectsSet: string
    ruleChangeDescription: string
    applyNow: string
    restartSet: string
    playerFallbackTeamA: string
    playerFallbackTeamB: string
  }
  matchList: {
    loading: string
    noMatches: string
    completed: string
    inProgress: string
    court: string
    code?: string
    error?: string
    showingLatest: string
  }
  courtsList: {
    title: string
    description: string
    refresh: string
    court: string
    occupied: string
    available: string
    jsonData: string
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
    tiebreakLength10: string
    tiebreakLength7: string
    title: string
    selectedCourt: string
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
    selectSets: string
    selectScoringSystem: string
    superSetDescription: string
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
    gamesPerSet: string
    gamesStandard: string
    gamesFast4: string
    goldenPoint: string
    goldenPointOff: string
    goldenPointFirstDeuce: string
    goldenPointSecondDeuce: string
    goldenPointThirdDeuce: string
    tiebreakPoints: string
    tiebreakTwoClear: string
    tiebreakReceiver12: string
    tiebreakReceiver123: string
    tiebreakReceiver13: string
    tiebreakSuddenDeath: string
    tiebreakToNStandard: string
    tiebreakToNChampionship: string
    tiebreakWith2Clear: string
    finalSetFinishLabel: string
    finalSetGamesTiebreak7: string
    finalSetGamesTiebreak10: string
    finalSetMatchTiebreak7: string
    finalSetMatchTiebreak10: string
    finalSetGamesTo12Tiebreak7: string
    finalSetGamesTo12Tiebreak10: string
    finalSetNoTiebreak: string
    setsNnormal: string
    setsNplusTiebreak: string
    selectTiebreakLength: string
    hidePerSetSettings: string
    showPerSetSettings: string
    setNumber: string
    errorAddingPlayer: string
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
  feedImport: {
    importFromTournament: string
    selectPlatform: string
    selectTournament: string
    selectLeague: string
    selectMode: string
    modeMatch: string
    modePlayers: string
    selectCategory: string
    selectMatch: string
    runningNow: string
    league: string
    noTournaments: string
    noMatches: string
    noPlayers: string
    matchLoaded: string
    playersImported: string
    loadError: string
    refresh: string
    search: string
    selectAll: string
    import: string
    changePlatform: string
    changeTournament: string
    startOver: string
  }
  debugPage: {
    backToHome: string
    tabDatabase: string
    tabConnection: string
    tabErrorLogs: string
    connectionDiagnostics: string
    runConnectionTest: string
    runningTest: string
    testResults: string
    checkingDatabase: string
    tableExists: string
    tableNotExists: string
    matchesTable: string
    playersTable: string
    tablesContent: string
    playersLabel: string
    matchesLabel: string
    playersEmpty: string
    matchesEmpty: string
    tablesNotCreated: string
    tablesNotCreatedDesc: string
    errorTitle: string
    checkTablesError: string
    checkDatabase: string
    checkingDatabaseStatus: string
    dbInitialization: string
    checkingTablesStatus: string
    tablesNotCreatedInit: string
    tablesNotCreatedInitDesc: string
    successTitle: string
    errorTitleShort: string
    dbInitializedSuccess: string
    dbInitError: string
    sqlExecutedSuccess: string
    sqlExecutionError: string
    sqlQuerySuccess: string
    sqlQueryError: string
    tabAutoInit: string
    tabManualCreation: string
    tabSqlScript: string
    tabCustomSql: string
    autoInitDescription: string
    initializeDatabase: string
    initializing: string
    tablesAlreadyCreated: string
    manualCreationDescription: string
    createMatchesTable: string
    createPlayersTable: string
    creatingTable: string
    matchesTableCreated: string
    playersTableCreated: string
    sqlScriptDescription: string
    customSqlDescription: string
    enterSqlPlaceholder: string
    executeSql: string
    executing: string
    checkTablesStatus: string
    errorLogTitle: string
    refreshBtn: string
    exportBtn: string
    clearBtn: string
    clearConfirm: string
    filterAll: string
    filterErrors: string
    filterWarnings: string
    filterInfo: string
    filterDebug: string
    loadingLog: string
    noRecordsFound: string
    logStorageNote: string
  }
  logMessages: {
    missingServerEnvVars: string
    creatingServerClient: string
    missingClientEnvVars: string
    creatingClientClient: string
    errorCreatingClient: string
    timeoutAvailability: string
    supabaseQueryError: string
    exceptionAvailability: string
    tablesNotExistDirect: string
    tablesExist: string
    timeoutCheckTables: string
    errorCheckTables: string
    timeoutCheckContent: string
    dbInitStart: string
    tablesAlreadyExist: string
    dbInitSuccess: string
    dbInitException: string
    timeoutSql: string
    errorDecompress: string
    dataCorrupted: string
    errorGetLocal: string
    errorSetLocal: string
    gettingMatches: string
    supabaseAvailableGetting: string
    matchesNotFoundInSupabase: string
    tablesNotExistUseLocal: string
    supabaseUnavailableUseLocal: string
    restoredFromLocal: string
    gotFromLocal: string
    errorGettingMatches: string
    errorProcessingKey: string
    errorSearchLocal: string
    gettingMatchById: string
    matchFromCache: string
    supabaseAvailableGettingMatch: string
    errorMatchFromSupabase: string
    matchGotFromSupabase: string
    initEmptySetsSupabase: string
    playerCountriesLoaded: string
    playerCountriesLoadFailed: string
    playerCountriesError: string
    matchNotFoundSupabase: string
    matchFoundLocal: string
    initEmptySetsLocal: string
    matchFoundInList: string
    initEmptySetsList: string
    matchNotFoundAnywhere: string
    errorGettingMatch: string
    cleaningStorage: string
    deletedOldMatch: string
    errorCleaningStorage: string
    creatingMatch: string
    initEmptySetsNew: string
    supabaseAvailableSaving: string
    errorSavingSupabase: string
    matchSavedSupabase: string
    tablesNotExistSaveLocal: string
    supabaseUnavailableSaveLocal: string
    matchSavedLocal: string
    errorCreatingMatch: string
    deletingMatch: string
    matchNotFoundForDelete: string
    supabaseAvailableDeleting: string
    errorDeletingSupabase: string
    matchDeletedSupabase: string
    tablesNotExistDeleteLocal: string
    supabaseUnavailableDeleteLocal: string
    matchDeletedLocal: string
    errorDeletingMatch: string
    matchNotFoundForSubscribe: string
    supabaseEventReceived: string
    subscribeStatus: string
    unsubscribeMatch: string
    tablesNotExistLocalSubscribe: string
    supabaseUnavailableLocalSubscribe: string
    checkingAvailability: string
    runningTestQuery: string
    supabaseAvailable: string
    errorCheckingAvailability: string
    exceptionCheckingAvailability: string
    gettingAllMatches: string
    gettingMatchByCourt: string
    invalidCourtNumber: string
    failedCreateClient: string
    activeMatchNotFoundSeekCompleted: string
    errorCompletedMatch: string
    matchNotFoundActiveOrCompleted: string
    initEmptySetsCompleted: string
    gotCompletedMatchByCourt: string
    gotMatchByCourt: string
    timeoutGetMatchByCourt: string
    errorGetMatchByCourt: string
    gettingOccupiedCourts: string
    errorOccupiedCourts: string
    noActiveMatchesOnCourts: string
    gotOccupiedCourts: string
    timeoutOccupiedCourts: string
    failedOccupiedUseLocal: string
    errorLocalCourts: string
    gotFreeCourts: string
    errorFreeCourts: string
    assigningMatchToCourt: string
    matchNotFound: string
    errorAssigningCourt: string
    matchAssignedToCourt: string
    timeoutAssigningCourt: string
    freeingCourt: string
    matchOnCourtNotFound: string
    errorFreeingCourt: string
    courtFreed: string
    timeoutFreeingCourt: string
    errorExecutingSql: string
    errorInitializingDb: string
    sqlExecuted: string
    sqlQueryError: string
    startConnectionTest: string
    connectionTestCompleted: string
    connectionTestFailed: string
    errorConnectionTest: string
    checkingTablesExist: string
    checkingTablesContent: string
    checkingDb: string
    checkingTablesStatus: string
    tablesCheckResult: string
    initDbResult: string
    sqlCreateResult: string
    sqlCreatePlayersResult: string
    matchSynced: string
    syncConflict: string
    operationDeadLetter: string
    flushQueueError: string
    revisionColumnMissing: string
    localStorageUnavailable: string
    operationLogCorrupted: string
    operationLogReadError: string
    operationLogSaveError: string
    operationLogListError: string
    errorFetchPlayers: string
    errorGetPlayers: string
    errorAddPlayerSupabase: string
    errorAddPlayer: string
    errorUpdatePlayerSupabase: string
    errorUpdatePlayer: string
    errorDeletePlayerSupabase: string
    errorDeletePlayer: string
    errorDeletePlayersSupabase: string
    errorDeletePlayers: string
    gettingMatchServer: string
    matchGotServer: string
    gettingMatchByCourtServer: string
    matchGotByCourtServer: string
    vmixGetError: string
    vmixGetException: string
    vmixGetByIdError: string
    vmixGetByIdException: string
    vmixGetDefaultError: string
    vmixGetDefaultException: string
    vmixResetDefaultError: string
    vmixCreateError: string
    vmixCreated: string
    vmixUpdateError: string
    vmixUpdated: string
    vmixSaveException: string
    vmixDeleteError: string
    vmixDeleted: string
    vmixDeleteException: string
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
      vmixOverlay: "Оверлей vMix",
      vmixSettings: "Настройки vMix",
      checking: "Проверка...",
      saving: "Сохранение...",
      enterFullscreen: "Полный экран",
      exitFullscreen: "Выйти из полного экрана",
      continue: "Продолжить",
      updateSettings: "Обновить настройки",
      updateSettingsDesc: "Обновить текущие настройки",
      settingsName: "Название настроек",
      settingsNamePlaceholder: "Введите название настроек...",
      useAsDefault: "Использовать по умолчанию",
      saveButton: "Сохранить",
      cancelButton: "Отмена",
      courtStatus: {
        matchInProgress: "Матч в процессе",
        matchInProgressDescription: "На этом корте уже идет матч. Пожалуйста, дождитесь его завершения или НАЖМИТЕ КРАСНУЮ КНОПКУ ЗАВЕРШЕНИЯ МАТЧА ПРИ ВХОДЕ НА КОРТ. Затем обновите страницу.",
        noMatch: "Корт свободен",
        noMatchDescription: "На этом корте нет активных матчей. Вы можете начать новый матч.",
        refresh: "Обновить",
        continue: "Продолжить",
        finishMatch: "Завершить матч",
        finishMatchButton: "Завершить матч",
        finishMatchLink: "Завершить матч по ссылке",
        matchFinished: "Матч завершен",
        finishMatchError: "Ошибка завершения матча",
        matchFinishedDescription: "Матч успешно завершен",
        finishMatchErrorDescription: "Произошла ошибка при завершении матча",
        managePlayers: "Управление игроками",
        activeMatches: "Активные матчи",
        activeMatchesDesc: "Просмотр и управление активными матчами",
        matchHistory: "История матчей",
        joinMatch: "Присоединиться к матчу",
        joinMatchDesc: "Присоединиться к существующему матчу",
        joinByCode: "Присоединиться по коду",
        diagnostics: "Диагностика"
      }
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
      switchServer: "Сменить подающего", // Russian: already correct
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
      windbreak: "Виндрейк (подача через гейм)",
      applySettings: "Применить настройки",
      unlockMatch: "Разблокировать матч",
      endMatch: "Завершить матч",
      confirmEndMatch: "Вы уверены, что хотите завершить матч? Вы сможете разблокировать его позже, если потребуется.",
      finishMatch: "Завершить матч",
      finishMatchButton: "Завершить матч",
      finishMatchLink: "Завершить матч по ссылке",
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
      court: "Корт",
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
      sideChange: "Смена стороны",
      sidesSwapped: "Стороны поменялись",
      switchServer: "Сменить подающего",
      switchSides: "Сменить стороны",
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
      invalidMatchId: "Некорректный ID матча",
      matchNotFound: "Матч не найден",
      matchNotFoundOrDeleted: "Матч не найден или был удален",
      errorLoadingMatch: "Ошибка загрузки матча",
      shareMatchTitle: "Счет теннисного матча",
      shareMatchText: "Следите за счетом матча в реальном времени",
      returnToHome: "Вернуться на главную",
      matchUpdateFailed: "Не удалось обновить матч. Попробуйте обновить страницу.",
      matchIsOver: "Матч завершён",
      finalTiebreak: "(Финальный тайбрейк)",
      teamWonConfirm: "Команда {team} выиграла матч! Завершить матч?",
      ruleChangeNoRestart: "Изменение нельзя применить без потерь",
      ruleChangeAffectsSet: "Изменение влияет на текущий сет",
      ruleChangeDescription: "Выберите, как применить это изменение правил.",
      applyNow: "Применить сейчас",
      restartSet: "Перезапустить текущий сет с 0:0",
      playerFallbackTeamA: "Игрок 1, Игрок 2",
      playerFallbackTeamB: "Игрок 3, Игрок 4",
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
      tiebreakLength10: "тайбрейк 10",
      tiebreakLength7: "тайбрейк 7",
      title: "Создание нового матча",
      selectedCourt: "Выбранный корт",
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
      selectSets: "Выберите количество сетов",
      selectScoringSystem: "Выберите систему подсчета очков",
      superSetDescription: "только 1 ПРО сет, играется до 8 геймов",
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
      gamesPerSet: "Количество геймов в сете",
      gamesStandard: "(стандарт)",
      gamesFast4: "(Fast4)",
      goldenPoint: "Золотое очко",
      goldenPointOff: "Выкл",
      goldenPointFirstDeuce: "Про - первый ровно",
      goldenPointSecondDeuce: "Любитель - второй ровно",
      goldenPointThirdDeuce: "Звезда - третий ровно",
      tiebreakPoints: "Очки тайбрейка",
      tiebreakTwoClear: "С разницей в 2 очка",
      tiebreakReceiver12: "Принимающий выбирает 1 или 2",
      tiebreakReceiver123: "Принимающий выбирает 1, 2 или 3",
      tiebreakReceiver13: "Принимающий выбирает 1 или 3",
      tiebreakSuddenDeath: "Внезапная смерть",
      tiebreakToNStandard: "До {n} очков (стандарт)",
      tiebreakToNChampionship: "До {n} очков (чемпионский)",
      tiebreakWith2Clear: "С разницей в 2 очка",
      finalSetFinishLabel: "Финальный сет — завершение",
      finalSetGamesTiebreak7: "Геймы как обычно — тайбрейк до 7",
      finalSetGamesTiebreak10: "Геймы как обычно — тайбрейк до 10",
      finalSetMatchTiebreak7: "Без геймов — матч-тайбрейк до 7",
      finalSetMatchTiebreak10: "Без геймов — матч-тайбрейк до 10",
      finalSetGamesTo12Tiebreak7: "Геймы до 12 — тайбрейк до 7",
      finalSetGamesTo12Tiebreak10: "Геймы до 12 — тайбрейк до 10",
      finalSetNoTiebreak: "Без тайбрейка",
      setsNnormal: "{n} — обычный",
      setsNplusTiebreak: "{n} + тайбрейк",
      selectTiebreakLength: "Выберите длину тайбрейка",
      hidePerSetSettings: "Скрыть настройки для каждого сета",
      showPerSetSettings: "Настроить для каждого сета отдельно",
      setNumber: "Сет {n}",
      errorAddingPlayer: "Произошла ошибка при добавлении игрока",
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
    feedImport: {
      importFromTournament: "Импорт из турнира",
      selectPlatform: "Выберите платформу",
      selectTournament: "Выберите турнир",
      selectLeague: "Выберите лигу",
      selectMode: "Что импортировать?",
      modeMatch: "Выбрать матч",
      modePlayers: "Выбрать игроков",
      selectCategory: "Выберите категорию",
      selectMatch: "Выберите матч",
      runningNow: "Идёт сейчас",
      league: "Лига",
      noTournaments: "Нет актуальных турниров",
      noMatches: "Нет матчей в этой категории",
      noPlayers: "Состав ещё не опубликован",
      matchLoaded: "Матч загружен из турнира",
      playersImported: "Добавлено игроков: {count}",
      loadError: "Не удалось загрузить данные фида",
      refresh: "Обновить",
      search: "Поиск...",
      selectAll: "Выбрать все",
      import: "Импортировать",
      changePlatform: "Сменить платформу",
      changeTournament: "Сменить турнир",
      startOver: "В начало",
    },
    debugPage: {
      backToHome: "На главную",
      tabDatabase: "База данных",
      tabConnection: "Соединение",
      tabErrorLogs: "Журнал ошибок",
      connectionDiagnostics: "Диагностика соединения с базой данных",
      runConnectionTest: "Запустить тест соединения",
      runningTest: "Выполнение теста...",
      testResults: "Результаты теста:",
      checkingDatabase: "Проверка базы данных...",
      tableExists: "Таблица существует",
      tableNotExists: "Таблица не существует",
      matchesTable: "Таблица матчей (matches)",
      playersTable: "Таблица игроков (players)",
      tablesContent: "Содержимое таблиц:",
      playersLabel: "Игроки",
      matchesLabel: "Матчи",
      playersEmpty: "Таблица игроков пуста",
      matchesEmpty: "Таблица матчей пуста",
      tablesNotCreated: "Таблицы не созданы",
      tablesNotCreatedDesc: "Для работы приложения необходимо создать таблицы в базе данных Supabase. Перейдите на вкладку «База данных» для инициализации.",
      errorTitle: "Ошибка",
      checkTablesError: "Не удалось проверить статус таблиц. Проверьте соединение с Supabase.",
      checkDatabase: "Проверить базу данных",
      checkingDatabaseStatus: "Проверка статуса таблиц...",
      dbInitialization: "Инициализация базы данных",
      checkingTablesStatus: "Проверка статуса таблиц...",
      tablesNotCreatedInit: "Таблицы не созданы",
      tablesNotCreatedInitDesc: "Для работы приложения необходимо создать таблицы в базе данных Supabase. Вы можете использовать автоматическую инициализацию или создать таблицы вручную.",
      successTitle: "Успешно",
      errorTitleShort: "Ошибка",
      dbInitializedSuccess: "База данных успешно инициализирована",
      dbInitError: "Ошибка при инициализации базы данных",
      sqlExecutedSuccess: "SQL выполнен успешно",
      sqlExecutionError: "Ошибка выполнения SQL",
      sqlQuerySuccess: "SQL-запрос успешно выполнен",
      sqlQueryError: "Ошибка",
      tabAutoInit: "Автоматическая инициализация",
      tabManualCreation: "Ручное создание",
      tabSqlScript: "SQL-скрипт",
      tabCustomSql: "Свой SQL",
      autoInitDescription: "Нажмите кнопку ниже, чтобы автоматически создать необходимые таблицы в базе данных Supabase. Этот метод требует наличия функции exec_sql в вашей базе данных.",
      initializeDatabase: "Инициализировать базу данных",
      initializing: "Инициализация...",
      tablesAlreadyCreated: "Таблицы уже созданы",
      manualCreationDescription: "Создайте таблицы по отдельности, если автоматическая инициализация не работает.",
      createMatchesTable: "Создать таблицу matches",
      createPlayersTable: "Создать таблицу players",
      creatingTable: "Создание таблицы...",
      matchesTableCreated: "Таблица matches уже создана",
      playersTableCreated: "Таблица players уже создана",
      sqlScriptDescription: "Вы также можете выполнить этот SQL-скрипт вручную в SQL-редакторе Supabase:",
      customSqlDescription: "Выполните произвольный SQL-запрос:",
      enterSqlPlaceholder: "Введите SQL-запрос...",
      executeSql: "Выполнить SQL",
      executing: "Выполнение...",
      checkTablesStatus: "Проверить статус таблиц",
      errorLogTitle: "Журнал ошибок и событий",
      refreshBtn: "Обновить",
      exportBtn: "Экспорт",
      clearBtn: "Очистить",
      clearConfirm: "Вы уверены, что хотите очистить журнал ошибок?",
      filterAll: "Все",
      filterErrors: "Ошибки",
      filterWarnings: "Предупреждения",
      filterInfo: "Информация",
      filterDebug: "Отладка",
      loadingLog: "Загрузка журнала...",
      noRecordsFound: "Записи не найдены",
      logStorageNote: "Журнал хранится только в локальном хранилище браузера и не отправляется на сервер.",
    },
    logMessages: {
      missingServerEnvVars: "Отсутствуют переменные окружения для Supabase на сервере",
      creatingServerClient: "Создание серверного клиента Supabase",
      missingClientEnvVars: "Отсутствуют переменные окружения для Supabase на клиенте",
      creatingClientClient: "Создание клиентского клиента Supabase",
      errorCreatingClient: "Ошибка при создании клиента Supabase",
      timeoutAvailability: "Таймаут при проверке доступности Supabase",
      supabaseQueryError: "Ошибка при запросе к Supabase: {error}",
      exceptionAvailability: "Исключение при проверке доступности Supabase",
      tablesNotExistDirect: "Таблицы в базе данных не существуют (проверка через прямые запросы)",
      tablesExist: "Таблицы в базе данных существуют",
      timeoutCheckTables: "Таймаут при проверке существования таблиц",
      errorCheckTables: "Ошибка при проверке существования таблиц",
      timeoutCheckContent: "Таймаут при проверке содержимого таблиц",
      dbInitStart: "Начало инициализации базы данных",
      tablesAlreadyExist: "Таблицы уже существуют, инициализация не требуется",
      dbInitSuccess: "База данных успешно инициализирована",
      dbInitException: "Исключение при инициализации базы данных",
      timeoutSql: "Таймаут при выполнении SQL",
      errorDecompress: "Ошибка при распаковке данных из localStorage: {key}",
      dataCorrupted: "Данные в localStorage повреждены: {key}",
      errorGetLocal: "Ошибка при получении данных из localStorage: {key}",
      errorSetLocal: "Ошибка при сохранении данных в localStorage: {key}",
      gettingMatches: "Получение списка матчей",
      supabaseAvailableGetting: "Supabase доступен, получаем матчи из базы данных",
      matchesNotFoundInSupabase: "Матчи в Supabase не найдены",
      tablesNotExistUseLocal: "Таблицы в Supabase не существуют, используем локальное хранилище",
      supabaseUnavailableUseLocal: "Supabase недоступен, используем локальное хранилище",
      restoredFromLocal: "Восстановлено {count} матчей из localStorage",
      gotFromLocal: "Получено {count} матчей из localStorage",
      errorGettingMatches: "Ошибка при получении матчей",
      errorProcessingKey: "Ошибка при обработке ключа {key}",
      errorSearchLocal: "Ошибка при поиске матчей в localStorage",
      gettingMatchById: "Получение матча по ID/коду: {id}",
      matchFromCache: "Матч {id} получен из кэша",
      supabaseAvailableGettingMatch: "Supabase доступен, получаем матч из базы данных",
      errorMatchFromSupabase: "Ошибка при получении матча из Supabase: {error}",
      matchGotFromSupabase: "Матч успешно получен из Supabase",
      initEmptySetsSupabase: "Инициализирован пустой массив sets для матча из Supabase",
      playerCountriesLoaded: "Информация о странах игроков успешно загружена",
      playerCountriesLoadFailed: "Не удалось загрузить информацию о странах игроков",
      playerCountriesError: "Ошибка при загрузке информации о странах игроков",
      matchNotFoundSupabase: "Матч не найден в Supabase",
      matchFoundLocal: "Матч найден в локальном хранилище",
      initEmptySetsLocal: "Инициализирован пустой массив sets для матча из localStorage",
      matchFoundInList: "Матч найден в общем списке локального хранилища",
      initEmptySetsList: "Инициализирован пустой массив sets для матча из списка",
      matchNotFoundAnywhere: "Матч не найден ни в Supabase, ни в локальном хранилище",
      errorGettingMatch: "Ошибка при получении матча: {error}",
      cleaningStorage: "Очистка локального хранилища: {count} матчей, лимит {limit}",
      deletedOldMatch: "Удален старый матч из localStorage: {id}",
      errorCleaningStorage: "Ошибка при очистке хранилища",
      creatingMatch: "Создание нового матча",
      initEmptySetsNew: "Инициализирован пустой массив sets для нового матча",
      supabaseAvailableSaving: "Supabase доступен, сохраняем матч в базу данных",
      errorSavingSupabase: "Ошибка при сохранении матча в Supabase: {error}",
      matchSavedSupabase: "Матч успешно сохранен в Supabase",
      tablesNotExistSaveLocal: "Таблицы в Supabase не существуют, сохраняем только в локальное хранилище",
      supabaseUnavailableSaveLocal: "Supabase недоступен, сохраняем только в локальное хранилище",
      matchSavedLocal: "Матч успешно сохранен в локальное хранилище",
      errorCreatingMatch: "Ошибка при создании матча: {error}",
      deletingMatch: "Удаление матча: {id}",
      matchNotFoundForDelete: "Матч не найден для удаления: {id}",
      supabaseAvailableDeleting: "Supabase доступен, удаляем матч из базы данных",
      errorDeletingSupabase: "Ошибка при удалении матча из Supabase: {error}",
      matchDeletedSupabase: "Матч успешно удален из Supabase",
      tablesNotExistDeleteLocal: "Таблицы в Supabase не существуют, удаляем только из локального хранилища",
      supabaseUnavailableDeleteLocal: "Supabase недоступен, удаляем только из локального хранилища",
      matchDeletedLocal: "Матч успешно удален из локального хранилища",
      errorDeletingMatch: "Ошибка при удалении матча: {error}",
      matchNotFoundForSubscribe: "Матч не найден для подписки: {id}",
      supabaseEventReceived: "Получено событие Supabase для матча {id}",
      subscribeStatus: "Статус подписки на матч {id}: {status}",
      unsubscribeMatch: "Отписка от обновлений матча {id}",
      tablesNotExistLocalSubscribe: "Таблицы в Supabase не существуют, используем локальную подписку",
      supabaseUnavailableLocalSubscribe: "Supabase недоступен, используем локальную подписку",
      checkingAvailability: "Проверка доступности Supabase",
      runningTestQuery: "Выполнение тестового запроса к Supabase",
      supabaseAvailable: "Supabase доступен",
      errorCheckingAvailability: "Ошибка при проверке доступности Supabase: {error}",
      exceptionCheckingAvailability: "Исключение при проверке доступности Supabase",
      gettingAllMatches: "Получение всех матчей для истории",
      gettingMatchByCourt: "Получение матча по номеру корта: {court}",
      invalidCourtNumber: "Некорректный номер корта",
      failedCreateClient: "Не удалось создать клиент Supabase",
      activeMatchNotFoundSeekCompleted: "Активный матч на корте {court} не найден, ищем завершенный",
      errorCompletedMatch: "Ошибка при получении завершенного матча: {error}",
      matchNotFoundActiveOrCompleted: "Матч не найден в Supabase (ни активный, ни завершенный)",
      initEmptySetsCompleted: "Инициализирован пустой массив sets для завершенного матча",
      gotCompletedMatchByCourt: "Получен завершенный матч по номеру корта",
      gotMatchByCourt: "Матч успешно получен по номеру корта",
      timeoutGetMatchByCourt: "Таймаут при получении матча по номеру корта",
      errorGetMatchByCourt: "Ошибка при получении матча по номеру корта: {error}",
      gettingOccupiedCourts: "Получение списка занятых кортов",
      errorOccupiedCourts: "Ошибка при получении списка занятых кортов: {error}",
      noActiveMatchesOnCourts: "Нет активных матчей на кортах",
      gotOccupiedCourts: "Получено {count} занятых кортов",
      timeoutOccupiedCourts: "Таймаут при получении списка занятых кортов",
      failedOccupiedUseLocal: "Не удалось получить занятые корты из Supabase, используем локальные данные",
      errorLocalCourts: "Ошибка при получении локальных данных о кортах",
      gotFreeCourts: "Получено {count} свободных кортов",
      errorFreeCourts: "Ошибка при получении списка свободных кортов: {error}",
      assigningMatchToCourt: "Назначение матча {matchId} на корт {court}",
      matchNotFound: "Матч не найден",
      errorAssigningCourt: "Ошибка при назначении матча на корт: {error}",
      matchAssignedToCourt: "Матч {matchId} успешно назначен на корт {court}",
      timeoutAssigningCourt: "Таймаут при назначении матча на корт",
      freeingCourt: "Освобождение корта {court}",
      matchOnCourtNotFound: "Матч на корте не найден",
      errorFreeingCourt: "Ошибка при освобождении корта: {error}",
      courtFreed: "Корт {court} успешно освобожден",
      timeoutFreeingCourt: "Таймаут при освобождении корта",
      errorExecutingSql: "Ошибка при выполнении SQL: {error}",
      errorInitializingDb: "Ошибка при инициализации базы данных: {error}",
      sqlExecuted: "SQL-запрос успешно выполнен",
      sqlQueryError: "Ошибка выполнения SQL",
      startConnectionTest: "Запуск теста соединения с Supabase",
      connectionTestCompleted: "Тест соединения завершен: успешно",
      connectionTestFailed: "Тест соединения завершен: неудачно",
      errorConnectionTest: "Ошибка при выполнении теста соединения",
      checkingTablesExist: "Проверка существования таблиц",
      checkingTablesContent: "Проверка содержимого таблиц",
      checkingDb: "Проверка базы данных",
      checkingTablesStatus: "Проверка статуса таблиц",
      tablesCheckResult: "Результат проверки таблиц",
      initDbResult: "Результат инициализации базы данных",
      sqlCreateResult: "Результат создания таблицы matches",
      sqlCreatePlayersResult: "Результат создания таблицы players",
      matchSynced: "Матч {id} синхронизирован, revision={revision}",
      syncConflict: "Конфликт синхронизации матча {id}: {reason}",
      operationDeadLetter: "Операция матча {id} перемещена в dead-letter: {error}",
      flushQueueError: "Ошибка слива очереди матча {id}",
      revisionColumnMissing: "Колонка matches.revision отсутствует — режим last-writer-wins",
      localStorageUnavailable: "localStorage недоступен — синхронизация работает в ограниченном режиме",
      operationLogCorrupted: "Журнал операций повреждён или устарел: {id}",
      operationLogReadError: "Не удалось прочитать журнал операций: {id}",
      operationLogSaveError: "Не удалось сохранить журнал операций (квота?): {id}",
      operationLogListError: "Не удалось перечислить журналы операций",
      errorFetchPlayers: "Ошибка при получении игроков из Supabase",
      errorGetPlayers: "Ошибка при получении игроков",
      errorAddPlayerSupabase: "Ошибка при добавлении игрока в Supabase",
      errorAddPlayer: "Ошибка при добавлении игрока",
      errorUpdatePlayerSupabase: "Ошибка при обновлении игрока в Supabase",
      errorUpdatePlayer: "Ошибка при обновлении игрока",
      errorDeletePlayerSupabase: "Ошибка при удалении игрока из Supabase",
      errorDeletePlayer: "Ошибка при удалении игрока",
      errorDeletePlayersSupabase: "Ошибка при удалении игроков из Supabase",
      errorDeletePlayers: "Ошибка при удалении игроков",
      gettingMatchServer: "Получение матча по ID (сервер): {id}",
      matchGotServer: "Матч успешно получен из Supabase (сервер)",
      gettingMatchByCourtServer: "Получение матча по номеру корта (сервер): {court}",
      matchGotByCourtServer: "Матч успешно получен из Supabase (сервер)",
      vmixGetError: "Ошибка при получении настроек vMix",
      vmixGetException: "Исключение при получении настроек vMix",
      vmixGetByIdError: "Ошибка при получении настроек vMix по ID: {id}",
      vmixGetByIdException: "Исключение при получении настроек vMix по ID",
      vmixGetDefaultError: "Ошибка при получении настроек vMix по умолчанию",
      vmixGetDefaultException: "Исключение при получении настроек vMix по умолчанию",
      vmixResetDefaultError: "Ошибка при сбросе флага 'по умолчанию'",
      vmixCreateError: "Ошибка при создании настроек vMix",
      vmixCreated: "Созданы новые настройки vMix: {name}",
      vmixUpdateError: "Ошибка при обновлении настроек vMix: {id}",
      vmixUpdated: "Обновлены настройки vMix: {name}",
      vmixSaveException: "Исключение при сохранении настроек vMix",
      vmixDeleteError: "Ошибка при удалении настроек vMix: {id}",
      vmixDeleted: "Удалены настройки vMix: {id}",
      vmixDeleteException: "Исключение при удалении настроек vMix",
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
      vmixOverlay: "vMix Overlay",
      vmixSettings: "vMix Settings",
      checking: "Checking...",
      saving: "Saving...",
      enterFullscreen: "Enter fullscreen",
      exitFullscreen: "Exit fullscreen",
      continue: "Continue",
      updateSettings: "Update settings",
      updateSettingsDesc: "Update current settings",
      settingsName: "Settings name",
      settingsNamePlaceholder: "Enter settings name...",
      useAsDefault: "Use as default",
      saveButton: "Save",
      cancelButton: "Cancel",
      courtStatus: {
        finishMatch: "Finish Match",
        finishMatchButton: "Finish Match",
        finishMatchLink: "Finish Match",
        matchFinished: "Match Finished",
        finishMatchError: "Error finishing match",
        matchFinishedDescription: "Match successfully finished.",
        finishMatchErrorDescription: "Error occurred while finishing match.",
        managePlayers: "Manage Players",
        activeMatches: "Active Matches",
        activeMatchesDesc: "Current matches",
        matchHistory: "Match History",
        joinMatch: "Join Match",
        joinMatchDesc: "Enter code to view match",
        joinByCode: "Join by code",
        diagnostics: "Diagnostics",
        matchInProgress: "Match in Progress",
        matchInProgressDescription: "A match is already in progress on this court. Please wait until it is over or PRESS THE RED BUTTON TO END THE MATCH WHEN ENTERING THE COURT. Then refresh the page.",
        noMatch: "Court Available",
        noMatchDescription: "No active matches on this court. You can start a new match.",
        refresh: "Refresh",
        continue: "Continue"
      }
    },
    home: {
      title: "Tennis & Padel Scoreboard",
      subtitle: "Track scores in real-time",
      newMatch: "Create new match",
      newMatchDesc: "Set up a new game with selected parameters",
      tennis: "Tennis",
      padel: "Padel",
      managePlayers: "Manage Players",
      activeMatches: "Active Matches",
      activeMatchesDesc: "Current and recent matches",
      matchHistory: "Match History",
      joinMatch: "Join Match",
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
      scoreCard: "Score Card",
      scoreControls: "Score Controls",
      addPoint: "Point",
      switchServer: "Switch Server", // English: already correct
      switchSides: "Switch Sides",
      leftSide: "Left Side",
      rightSide: "Right Side",
      needToSwitchSides: "Need to switch sides! Sides will be switched automatically on the next score change.",
      management: "Management",
      matchManagement: "Match Management",
      editPlayers: "Edit Players",
      editTeams: "Edit Teams",
      matchStatus: "Match Status",
      matchType: "Match Type",
      courtNumber: "Court Number",
      completedMatch: "Completed",
      inProgressMatch: "In Progress",
      deleteMatch: "Delete Match",
      confirmDeleteMatch: "Confirm Deletion",
      deleteMatchWarning: "Are you sure you want to delete this match? This action cannot be undone.",
      deleteMatchConfirm: "Yes, delete",
      deleteMatchCancel: "Cancel",
      matchDeleted: "Match successfully deleted",
      matchDeleteError: "Error deleting match",
      noCourtAssigned: "Not assigned",
      selectCourt: "Select Court",
      courtAlreadyOccupied: "This court is already occupied",
      updateCourt: "Update Court",
      courtUpdated: "Court successfully updated",
      courtUpdateError: "Error updating court",
      scoreEditing: "Score Editing",
      currentSet: "current",
      startTiebreakManually: "Start Tiebreak Manually",
      teamWonTiebreak: "Team won tiebreak",
      matchCode: "Match Code",
      scoringSystem: "Scoring System",
      classicScoring: "Classic (AD)",
      noAdScoring: "No-Ad (deuce → deciding point)",
      fast4Scoring: "Fast4 (up to 4 games)",
      tiebreakType: "Tiebreak Type",
      regularTiebreak: "Regular (to 7)",
      championshipTiebreak: "Championship (to 10)",
      superTiebreak: "Super Tiebreak (instead of 3rd set)",
      tiebreakAt: "Tiebreak at score",
      selectTiebreakScore: "Select tiebreak score",
      additional: "Additional",
      goldenGame: "Golden Game (Padel)",
      windbreak: "Windbreak (serve every other game)",
      applySettings: "Apply Settings",
      unlockMatch: "Unlock Match",
      endMatch: "End Match",
      confirmEndMatch: "Are you sure you want to end the match? You can unlock it later if needed.",
      finishMatch: "Finish Match",
      finishMatchButton: "Finish Match",
      finishMatchLink: "Finish match by link",
      teamWonMatch: "{{team}} won the match! What do you want to do?",
      serving: "Serving",
      currentGame: "Current Game",
      editSets: "Edit Set Scores",
      setXofY: "Set {{current}} of {{total}}",
      setX: "Set {{number}}",
      current: "Current",
      tiebreak: "Tiebreak",
      of: "of",
      fixedSides: "Fixed Sides",
      fixedPlayers: "Fixed Players",
      toServe: "to serve",
      to: "to",
      loveAll: "love all",
      play: "play",
    },
    scoreboard: {
      tennis: "Tennis",
      padel: "Padel",
      singles: "Singles",
      doubles: "Doubles",
      matchCompleted: "Match Completed",
      set: "Set",
      of: "of",
      tiebreak: "Tiebreak",
      game: "Game",
      leftCourtSide: "Left Court Side",
      rightCourtSide: "Right Court Side",
      currentServer: "Current Server",
      playerA: "Player A",
      playerB: "Player B",
      court: "Court",
    },
    scoreboardSettings: {
      title: "Display Settings",
      presets: "Presets",
      colors: "Colors",
      display: "Display",
      sizes: "Sizes",
      advancedColors: "Advanced Colors",
      darkTheme: "Dark",
      lightTheme: "Light",
      contrastTheme: "Contrast",
      neutralTheme: "Neutral",
      backgroundColor: "Background Color",
      textColor: "Text Color",
      teamAColors: "Team A Colors",
      teamBColors: "Team B Colors",
      startColor: "Start Color",
      endColor: "End Color",
      showCourtSides: "Show court sides",
      showCurrentServer: "Show current server block",
      showServerIndicator: "Show serve indicator near names",
      showSetsScore: "Show sets score",
      useCustomSizes: "Use custom sizes",
      fontSize: "General Font Size",
      playerCellWidth: "Player Name Cell Width",
      playerNamesFontSize: "Player Names Font Size",
      gameScoreFontSize: "Game Score Font Size",
      setsScoreFontSize: "Sets Score Font Size",
      infoBlockFontSize: "Info Blocks Font Size",
      gameScoreTextColor: "Game Score Text Color",
      gameCellBgColor: "Game Cell Background Color",
      tiebreakCellBgColor: "Tiebreak Cell Background Color",
      setsScoreTextColor: "Sets Score Text Color",
      done: "Done",
    },
    matchPage: {
      loadingMatch: "Loading match...",
      sideChange: "Side Change",
      sidesSwapped: "Sides Swapped",
      switchServer: "Switch Server",
      switchSides: "Switch Sides",
      errorTitle: "Error",
      createNewMatch: "Create New Match",
      home: "Home",
      court: "Court",
      share: "Share",
      viewScore: "View Score",
      notification: "Notification",
      matchTab: "Match",
      exportImportTab: "Export/Import",
      exportMatch: "Export Match",
      exportDescription: "Copy match data to save or transfer to another device",
      exportButton: "Export Data",
      importMatch: "Import Match",
      importDescription: "Paste match data to import",
      importPlaceholder: "Paste match data in JSON format",
      importButton: "Import Data",
      technicalFunctions: "Technical Functions",
      matchCode: "Match Code",
      jsonCourt: "JSON COURT",
      vmixCourt: "vMix Court",
      jsonMatch: "JSON MATCH",
      vmixMatch: "vMix Match",
      scoreUpdated: "Score updated",
      linkCopied: "Link copied to clipboard",
      matchCodeCopied: "Match code copied to clipboard",
      matchDataCopied: "Match data copied to clipboard",
      importDataRequired: "Enter data to import",
      matchImported: "Match successfully imported",
      importError: "Error importing match. Check data format.",
      matchDataSimplified: "Match data has been simplified due to storage limitations",
      backToMatchControl: "Back to Match Control",
      invalidMatchId: "Invalid match ID",
      matchNotFound: "Match not found",
      matchNotFoundOrDeleted: "Match not found or was deleted",
      errorLoadingMatch: "Error loading match",
      shareMatchTitle: "Tennis Match Score",
      shareMatchText: "Follow the match score in real time",
      returnToHome: "Return to Home",
      matchUpdateFailed: "Failed to update match. Try refreshing the page.",
      matchIsOver: "Match is over",
      finalTiebreak: "(Final tiebreak)",
      teamWonConfirm: "Team {team} won the match! End the match?",
      ruleChangeNoRestart: "Change cannot be applied without data loss",
      ruleChangeAffectsSet: "Change affects the current set",
      ruleChangeDescription: "Choose how to apply this rule change.",
      applyNow: "Apply now",
      restartSet: "Restart current set from 0:0",
      playerFallbackTeamA: "Player 1, Player 2",
      playerFallbackTeamB: "Player 3, Player 4",
    },
    matchList: {
      loading: "Loading matches...",
      error: "Error loading matches",
      noMatches: "No active matches",
      court: "Court",
      completed: "Completed",
      inProgress: "In Progress",
      code: "Code",
      showingLatest: "Showing latest {{count}} matches",
    },
    courtsList: {
      title: "Courts Status",
      description: "Information about occupied courts",
      refresh: "Refresh",
      court: "Court",
      occupied: "Occupied",
      available: "Available",
      jsonData: "JSON Data",
    },
    supabaseStatus: {
      checking: "Checking...",
      online: "Online",
      offline: "Offline",
      checkingTooltip: "Checking database connection...",
      onlineTooltip: "Synchronization enabled. Matches are available on all devices.",
      offlineTooltip: "Synchronization disabled. Matches are saved locally only.",
      connectionInfo: "Database Connection Information",
      connectionDetails: "Detailed information about Supabase connection status",
      connectionEstablished: "Connection established",
      connectionMissing: "Connection missing",
      checkNow: "Check Now",
      connectionDetailsTitle: "Connection Details:",
      possibleIssues: "Possible reasons for connection problems:",
      issueInternet: "No internet connection",
      issueCredentials: "Invalid Supabase credentials",
      issueServer: "Supabase server unavailable",
      issueCors: "CORS or network settings issues",
      issueEnvVars: "Missing required environment variables",
      close: "Close",
    },
    players: {
      title: "Manage Players",
      addPlayer: "Add Player",
      editPlayer: "Edit Player",
      deletePlayer: "Delete Player",
      deletePlayers: "Delete Players",
      deletePlayersConfirm: "Are you sure you want to delete the selected players?",
      deletePlayersWarning: "This action cannot be undone.",
      deleteSelected: "Delete Selected",
      name: "Name",
      country: "Country",
      countryAbbreviation: "Country Abbreviation (ENG, RUS, ESP...)",
      selectPlayer: "Select Player",
      searchPlayer: "Search player...",
      playerNotFound: "Player not found",
      selectAll: "Select All",
      loadingPlayers: "Loading players...",
      emptyList: "Player list is empty",
      totalPlayers: "Total Players",
      selected: "Selected",
      errorAddingPlayer: "Error adding player",
      errorDeletingPlayers: "Error deleting players",
      noPlayersFound: "No players found",
    },
    newMatch: {
      tiebreakLength10: "Tiebreak 10",
      tiebreakLength7: "Tiebreak 7",
      title: "Create New Match",
      selectedCourt: "Selected Court",
      tennisDesc: "Setup tennis match",
      padelDesc: "Setup padel match",
      players: "Players",
      player1: "Player 1",
      player2: "Player 2",
      team1Player1: "Team 1 - Player 1",
      team1Player2: "Team 1 - Player 2",
      team2Player1: "Team 2 - Player 1",
      team2Player2: "Team 2 - Player 2",
      createMatch: "Create Match",
      matchSettings: "Match Settings",
      sets: "Number of Sets",
      games: "Games per Set",
      tiebreak: "Tiebreak",
      finalSetTiebreak: "Tiebreak in Deciding Set",
      finalSetTiebreakLength: "Deciding Set Tiebreak Length",
      finalSetTiebreakLengthDescription: "Select the length of the tiebreak in the deciding set",
      finalSetTiebreakNote: "This setting only affects the final set and is not related to regular tiebreaks.",
      goldenGame: "Golden Game (Padel)",
      windbreak: "Windbreak (serve every other game)",
      format: "Game Format",
      selectFormat: "Select Format",
      singles: "Singles",
      doubles: "Doubles",
      oneSets: "1 Set",
      twoSets: "2 Sets (tiebreak in 3rd)",
      threeSets: "3 Sets",
      fiveSets: "5 Sets (Grand Slam)",
      scoringSystem: "Scoring System",
      classicScoring: "Classic (AD)",
      noAdScoring: "No-Ad (deuce → deciding point)",
      fast4Scoring: "Fast4 (up to 4 games)",
      tiebreakType: "Tiebreak Type",
      regularTiebreak: "Regular (to 7)",
      championshipTiebreak: "Championship (to 10)",
      superTiebreak: "Super Tiebreak (instead of 3rd set)",
      tiebreakAt: "Tiebreak at score",
      selectTiebreakScore: "Select tiebreak score",
      additional: "Additional",
      firstServe: "First Serve",
      teamASide: "Team A Side",
      left: "Left",
      right: "Right",
      courtSelection: "Court Selection",
      noCourt: "No Court",
      court: "Court",
      checkingCourtAvailability: "Checking court availability...",
      occupiedCourts: "Occupied Courts",
      allCourtsAvailable: "All courts available",
      startMatch: "Start Match",
      selectAllPlayers: "Select players for both teams",
      selectAllPlayersForDoubles: "All players must be selected for doubles",
      courtOccupied: "Court {{court}} is already occupied. Select another court.",
      superSet: "PRO set to 8 games",
      matchRound: "Match Round",
      selectMatchRound: "Select Match Round",
      selectSets: "Select Sets",
      selectScoringSystem: "Select Scoring System",
      superSetDescription: "PRO set to 8 games",
      matchRounds: {
        none: "Not Selected",
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
      gamesPerSet: "Games per set",
      gamesStandard: "(standard)",
      gamesFast4: "(Fast4)",
      goldenPoint: "Golden Point",
      goldenPointOff: "Off",
      goldenPointFirstDeuce: "Pro - first deuce",
      goldenPointSecondDeuce: "Amateur - second deuce",
      goldenPointThirdDeuce: "Star - third deuce",
      tiebreakPoints: "Tiebreak points",
      tiebreakTwoClear: "Two clear points",
      tiebreakReceiver12: "Receiver selects 1 or 2",
      tiebreakReceiver123: "Receiver selects 1, 2 or 3",
      tiebreakReceiver13: "Receiver selects 1 or 3",
      tiebreakSuddenDeath: "Sudden death",
      tiebreakToNStandard: "To {n} points (standard)",
      tiebreakToNChampionship: "To {n} points (championship)",
      tiebreakWith2Clear: "With 2 clear points",
      finalSetFinishLabel: "Final set finish",
      finalSetGamesTiebreak7: "Games as normal - tiebreak to 7",
      finalSetGamesTiebreak10: "Games as normal - tiebreak to 10",
      finalSetMatchTiebreak7: "No games - match tiebreak to 7",
      finalSetMatchTiebreak10: "No games - match tiebreak to 10",
      finalSetGamesTo12Tiebreak7: "Games to 12 - tiebreak to 7",
      finalSetGamesTo12Tiebreak10: "Games to 12 - tiebreak to 10",
      finalSetNoTiebreak: "No tiebreak",
      setsNnormal: "{n} — normal",
      setsNplusTiebreak: "{n} + tiebreak",
      selectTiebreakLength: "Select tiebreak length",
      hidePerSetSettings: "Hide per-set settings",
      showPerSetSettings: "Configure per set individually",
      setNumber: "Set {n}",
      errorAddingPlayer: "Error adding player",
    },
    vmixSettings: {
      title: "vMix Settings for Match",
      backToMatch: "Back to Match",
      settingsFor: "Settings for Match",
      displaySettings: "Display Settings",
      apiForVmix: "API for vMix",
      basicSettings: "Basic Settings",
      configureBasicParams: "Configure basic display parameters",
      theme: "Theme",
      selectTheme: "Select Theme",
      customTheme: "Custom",
      transparentTheme: "Transparent",
      fontSize: "Font Size",
      selectFontSize: "Select Font Size",
      smallSize: "Small",
      mediumSize: "Medium",
      largeSize: "Large",
      xlargeSize: "Extra Large",
      playerNamesFontSize: "Player Names Font Size",
      bgOpacity: "Background Opacity",
      textColor: "Text Color",
      serveIndicatorColor: "Serve Indicator Color",
      colorsAndGradients: "Colors and Gradients",
      configureColorsAndGradients: "Configure colors and gradients for various blocks",
      playerNamesBlock: "Player Names Block",
      playerNamesBgColor: "Player Names Background Color",
      useGradientForNames: "Use gradient for names",
      namesGradientStartColor: "Names Gradient Start Color",
      namesGradientEndColor: "Names Gradient End Color",
      countriesBlock: "Player Countries Block",
      countriesBgColor: "Countries Background Color",
      useGradientForCountries: "Use gradient for countries",
      countriesGradientStartColor: "Countries Gradient Start Color",
      countriesGradientEndColor: "Countries Gradient End Color",
      serveIndicatorBlock: "Serve Indicator Block",
      serveIndicatorBgColor: "Serve Indicator Background Color",
      useGradientForServeIndicator: "Use gradient for serve indicator background",
      serveIndicatorGradientStartColor: "Serve Indicator Background Gradient Start Color",
      serveIndicatorGradientEndColor: "Serve Indicator Background Gradient End Color",
      serveIndicatorExample: "Serve Indicator Example",
      currentScoreBlock: "Current Score Block",
      currentScoreBgColor: "Current Score Background Color",
      useGradientForCurrentScore: "Use gradient for score",
      currentScoreGradientStartColor: "Score Gradient Start Color",
      currentScoreGradientEndColor: "Score Gradient End Color",
      setsScoreBlock: "Sets Score Block",
      setsBgColor: "Sets Score Background Color",
      setsTextColor: "Sets Score Text Color",
      useGradientForSets: "Use gradient for sets score",
      setsGradientStartColor: "Sets Score Gradient Start Color",
      setsGradientEndColor: "Sets Score Gradient End Color",
      importantMomentsIndicator: "Important Moments Indicator",
      indicatorBgColor: "Indicator Background Color",
      indicatorTextColor: "Indicator Text Color",
      useGradientForIndicator: "Use gradient for indicator",
      indicatorGradientStartColor: "Indicator Gradient Start Color",
      indicatorGradientEndColor: "Indicator Gradient End Color",
      actions: "Actions",
      previewAndUseSettings: "Preview and Use Settings",
      preview: "Preview with current settings",
      openInNewWindow: "Open in New Window",
      openInCurrentWindow: "Open in Current Window",
      copyUrl: "Copy URL",
      copying: "Copying...",
      saveSettings: "Save Settings",
      jsonApiForVmix: "JSON API for vMix",
      useApiForVmixData: "Use this API to get match data in JSON format",
      jsonApiUrl: "JSON API URL",
      instructionsForVmix: "Instructions for vMix",
      dataSourceSetup: "Data Source Setup in vMix:",
      titleDesignerUsage: "Usage in Title Designer:",
      titleDesignerSteps:
        'In vMix, go to "Settings" → "Data Sources"\nClick "Add" and select "Web"\nPaste the API URL into the "URL" field\nSet "Update Interval" to 1-2 seconds\nClick "OK" to save',
      availableDataFields: "Available Data Fields",
      teamA: "Team A:",
      teamB: "Team B:",
      generalData: "General Data:",
      dataFormatExample: "Data Format Example",
      settingsSaved: "Settings saved",
      errorSavingSettings: "Failed to save settings",
      teamAName: "Team A Name",
      teamAScore: "Team A Score",
      teamAGameScore: "Team A Current Game Score",
      teamACurrentSet: "Team A Current Set",
      teamAServing: "Team A Serving",
      teamASetScores: "Team A Set Scores",
      teamBName: "Team B Name",
      teamBScore: "Team B Score",
      teamBGameScore: "Team B Current Game Score",
      teamBCurrentSet: "Team B Current Set",
      teamBServing: "Team B Serving",
      teamBSetScores: "Team B Set Scores",
      matchId: "Match ID",
      isTiebreak: "Is Tiebreak",
      isCompleted: "Is Completed",
      winner: "Winner",
      updateTime: "Update Time",
      copyJsonApiUrl: "Copy JSON API URL",
      openCourtInNewWindow: "Open Court in New Window",
      openCourtInCurrentWindow: "Open Court in Current Window",
      copyCourtUrl: "Copy Court URL",
      actionsForCourtPage: "Actions for Court Page:",
      courtNotAssigned: "Match is not assigned to a court. Assign the match to a court to use these functions.",
      selectSaveOrDeleteSettings: "Select, save or delete vMix settings",
      saveSettingsDialog: "Save vMix Settings",
      saveSettingsDescription: "Enter a name for the settings and choose if they should be used by default",
      settingsName: "Settings Name",
      settingsNamePlaceholder: "Enter settings name",
      useAsDefault: "Use as default",
      cancelButton: "Cancel",
      savingButton: "Saving...",
      saveButton: "Save",
      savedSettings: "Saved Settings",
      selectSettings: "Select Settings",
      small: "Small",
      normal: "Normal",
      large: "Large",
      xlarge: "Extra Large",
      playerNameBlock: "Player Name Block",
      playerNameBgColor: "Player Name Background Color",
      playerCountryBlock: "Player Country Block",
      playerCountryBgColor: "Player Country Background Color",
      useApiToGetMatchData: "Use this API to get match data in JSON format",
      goToSettingsDataSources: 'In vMix, go to "Settings" → "Data Sources"',
      clickAddAndSelectWeb: 'Click "Add" and select "Web"',
      pasteApiUrl: 'Paste the API URL into the "URL" field',
      setUpdateInterval: 'Set "Update Interval" to 1-2 seconds',
      clickOkToSave: 'Click "OK" to save',
      createOrOpenTitle: "Create a new Title or open an existing one",
      addTextFields: "Add text fields to display data",
      inTextFieldPropertiesSelectDataBinding: 'In text field properties, select "Data Binding"',
      selectDataSourceAndField: 'Select your Data Source and the required field (e.g., "teamA_name")',
      repeatForAllFields: "Repeat for all required fields",
      urlCopied: "URL Copied",
      vmixUrlCopied: "vMix URL copied to clipboard",
      courtUrlCopied: "Court URL copied to clipboard",
      jsonApiUrlCopied: "JSON API URL copied to clipboard",
      failedToCopyUrl: "Failed to copy URL",
      openCourtPageNewWindow: "Open court {courtNumber} page in new window",
      openCourtPageCurrentWindow: "Open court {courtNumber} page in current window",
      copyCourtPageUrl: "Copy court {courtNumber} page URL",
      matchNotAssignedToCourt: "Match is not assigned to a court. Assign the match to a court to use these functions.",
      loadingSettings: "Loading settings...",
      backgroundOpacity: "Background Opacity",
      accentColor: "Accent Color",
      previewWithCurrentSettings: "Preview with current settings",
      matchInfo: "Match Info",
    },
    courtVmixSettings: {
      title: "vMix Settings for Court",
      backToMatch: "Back",
      settingsForCourt: "vMix Settings for Court {number}",
      noActiveMatches: "No active matches on this court",
      matchOnCourt: "Match on this court",
      displaySettings: "Display Settings",
      apiForVmix: "API for vMix",
      basicSettings: "Basic Settings",
      configureBasicParams: "Configure basic display parameters",
      theme: "Theme",
      selectTheme: "Select Theme",
      customTheme: "Custom",
      transparentTheme: "Transparent",
      fontSize: "Font Size",
      selectFontSize: "Select Font Size",
      smallSize: "Small",
      mediumSize: "Medium",
      largeSize: "Large",
      xlargeSize: "Extra Large",
      playerNamesFontSize: "Player Names Font Size",
      bgOpacity: "Background Opacity",
      textColor: "Text Color",
      serveIndicatorColor: "Serve Indicator Color",
      colorsAndGradients: "Colors and Gradients",
      configureColorsAndGradients: "Configure colors and gradients for various blocks",
      playerNamesBlock: "Player Names Block",
      playerNamesBgColor: "Player Names Background Color",
      useGradientForNames: "Use gradient for names",
      namesGradientStartColor: "Names Gradient Start Color",
      namesGradientEndColor: "Names Gradient End Color",
      countriesBlock: "Player Countries Block",
      countriesBgColor: "Countries Background Color",
      useGradientForCountries: "Use gradient for countries",
      countriesGradientStartColor: "Countries Gradient Start Color",
      countriesGradientEndColor: "Countries Gradient End Color",
      serveIndicatorBlock: "Serve Indicator Block",
      serveIndicatorBgColor: "Serve Indicator Background Color",
      useGradientForServeIndicator: "Use gradient for serve indicator background",
      serveIndicatorGradientStartColor: "Serve Indicator Background Gradient Start Color",
      serveIndicatorGradientEndColor: "Serve Indicator Background Gradient End Color",
      serveIndicatorExample: "Serve Indicator Example",
      currentScoreBlock: "Current Score Block",
      currentScoreBgColor: "Current Score Background Color",
      useGradientForCurrentScore: "Use gradient for score",
      currentScoreGradientStartColor: "Score Gradient Start Color",
      currentScoreGradientEndColor: "Score Gradient End Color",
      setsScoreBlock: "Sets Score Block",
      setsBgColor: "Sets Score Background Color",
      setsTextColor: "Sets Score Text Color",
      useGradientForSets: "Use gradient for sets score",
      setsGradientStartColor: "Sets Score Gradient Start Color",
      setsGradientEndColor: "Sets Score Gradient End Color",
      importantMomentsIndicator: "Important Moments Indicator",
      indicatorBgColor: "Indicator Background Color",
      indicatorTextColor: "Indicator Text Color",
      useGradientForIndicator: "Use gradient for indicator",
      indicatorGradientStartColor: "Indicator Gradient Start Color",
      indicatorGradientEndColor: "Indicator Gradient End Color",
      actions: "Actions",
      previewAndUseSettings: "Preview and Use Settings",
      preview: "Preview with current settings",
      openInNewWindow: "Open in New Window",
      openInCurrentWindow: "Open in Current Window",
      copyUrl: "Copy URL",
      copying: "Copying...",
      saveSettings: "Save Settings",
      jsonApiForVmix: "JSON API for vMix",
      useApiForVmixData: "Use this API to get match data in JSON format",
      jsonApiUrl: "JSON API URL",
      instructionsForVmix: "Instructions for vMix",
      dataSourceSetup: "Data Source Setup in vMix:",
      dataSourceSteps: "Data Source Setup Steps:",
      titleDesignerUsage: "Usage in Title Designer:",
      titleDesignerSteps:
        'In vMix, go to "Settings" → "Data Sources"\nClick "Add" and select "Web"\nPaste the API URL into the "URL" field\nSet "Update Interval" to 1-2 seconds\nClick "OK" to save',
      availableDataFields: "Available Data Fields",
      teamA: "Team A:",
      teamB: "Team B:",
      generalData: "General Data:",
      dataFormatExample: "Data Format Example",
      settingsSaved: "Settings saved",
      errorSavingSettings: "Failed to save settings",
      loadingSettings: "Loading settings...",
      teamAName: "Team A Name",
      teamAScore: "Team A Score",
      teamAGameScore: "Team A Current Game Score",
      teamACurrentSet: "Team A Current Set",
      teamAServing: "Team A Serving",
      teamASetScores: "Team A Set Scores",
      teamBName: "Team B Name",
      teamBScore: "Team B Score",
      teamBGameScore: "Team B Current Game Score",
      teamBCurrentSet: "Team B Current Set",
      teamBServing: "Team B Serving",
      teamBSetScores: "Team B Set Scores",
      matchId: "Match ID",
      isTiebreak: "Is Tiebreak",
      isCompleted: "Is Completed",
      winner: "Winner",
      updateTime: "Update Time",
      copyJsonApiUrl: "Copy JSON API URL",
      showPlayerNames: "Show Player Names",
      showCurrentPoints: "Show Current Points",
      showSetsScore: "Show Sets Score",
      showServer: "Show Server",
      showCountries: "Show Countries",
      savedSettings: "Saved Settings",
      selectSaveOrDeleteSettings: "Select, save or delete vMix settings",
      saveSettingsDialog: "Save vMix Settings",
      saveSettingsDescription: "Enter a name for the settings and choose if they should be used by default",
      settingsName: "Settings Name",
      settingsNamePlaceholder: "Enter settings name",
      useAsDefault: "Use as default",
      cancelButton: "Cancel",
      savingButton: "Saving...",
      saveButton: "Save",
      selectSettings: "Select Settings",
      createNewSettings: "Create New Settings",
      updateSettings: "Update Settings",
      deleteSettings: "Delete Settings",
      saveToDatabase: "Save to Database",
      deletingButton: "Deleting...",
      deleteButton: "Delete",
      deleteSettingsDialog: "Delete vMix Settings",
      deleteSettingsDescription: "Are you sure you want to delete these settings?",
      matchInfo: "Match Info",
    },
    feedImport: {
      importFromTournament: "Import from tournament",
      selectPlatform: "Select a platform",
      selectTournament: "Select a tournament",
      selectLeague: "Select a league",
      selectMode: "What to import?",
      modeMatch: "Pick a match",
      modePlayers: "Pick players",
      selectCategory: "Select a category",
      selectMatch: "Select a match",
      runningNow: "Running now",
      league: "League",
      noTournaments: "No active tournaments",
      noMatches: "No matches in this category",
      noPlayers: "Roster not published yet",
      matchLoaded: "Match loaded from tournament",
      playersImported: "Players added: {count}",
      loadError: "Failed to load feed data",
      refresh: "Refresh",
      search: "Search...",
      selectAll: "Select all",
      import: "Import",
      changePlatform: "Change platform",
      changeTournament: "Change tournament",
      startOver: "Start over",
    },
    debugPage: {
      backToHome: "Back to Home",
      tabDatabase: "Database",
      tabConnection: "Connection",
      tabErrorLogs: "Error Logs",
      connectionDiagnostics: "Database Connection Diagnostics",
      runConnectionTest: "Run Connection Test",
      runningTest: "Running test...",
      testResults: "Test Results:",
      checkingDatabase: "Checking database...",
      tableExists: "Table exists",
      tableNotExists: "Table does not exist",
      matchesTable: "Matches table (matches)",
      playersTable: "Players table (players)",
      tablesContent: "Tables content:",
      playersLabel: "Players",
      matchesLabel: "Matches",
      playersEmpty: "Players table is empty",
      matchesEmpty: "Matches table is empty",
      tablesNotCreated: "Tables not created",
      tablesNotCreatedDesc: "Tables must be created in the Supabase database for the application to work. Go to the \"Database\" tab to initialize.",
      errorTitle: "Error",
      checkTablesError: "Failed to check table status. Check the Supabase connection.",
      checkDatabase: "Check Database",
      checkingDatabaseStatus: "Checking table status...",
      dbInitialization: "Database Initialization",
      checkingTablesStatus: "Checking table status...",
      tablesNotCreatedInit: "Tables not created",
      tablesNotCreatedInitDesc: "Tables must be created in the Supabase database for the application to work. You can use automatic initialization or create tables manually.",
      successTitle: "Success",
      errorTitleShort: "Error",
      dbInitializedSuccess: "Database initialized successfully",
      dbInitError: "Error initializing database",
      sqlExecutedSuccess: "SQL executed successfully",
      sqlExecutionError: "SQL execution error",
      sqlQuerySuccess: "SQL query executed successfully",
      sqlQueryError: "Error",
      tabAutoInit: "Auto Initialization",
      tabManualCreation: "Manual Creation",
      tabSqlScript: "SQL Script",
      tabCustomSql: "Custom SQL",
      autoInitDescription: "Click the button below to automatically create the required tables in the Supabase database. This method requires the exec_sql function in your database.",
      initializeDatabase: "Initialize Database",
      initializing: "Initializing...",
      tablesAlreadyCreated: "Tables already created",
      manualCreationDescription: "Create tables individually if automatic initialization doesn't work.",
      createMatchesTable: "Create matches table",
      createPlayersTable: "Create players table",
      creatingTable: "Creating table...",
      matchesTableCreated: "Matches table already created",
      playersTableCreated: "Players table already created",
      sqlScriptDescription: "You can also run this SQL script manually in the Supabase SQL editor:",
      customSqlDescription: "Execute a custom SQL query:",
      enterSqlPlaceholder: "Enter SQL query...",
      executeSql: "Execute SQL",
      executing: "Executing...",
      checkTablesStatus: "Check Table Status",
      errorLogTitle: "Error and Event Log",
      refreshBtn: "Refresh",
      exportBtn: "Export",
      clearBtn: "Clear",
      clearConfirm: "Are you sure you want to clear the error log?",
      filterAll: "All",
      filterErrors: "Errors",
      filterWarnings: "Warnings",
      filterInfo: "Info",
      filterDebug: "Debug",
      loadingLog: "Loading log...",
      noRecordsFound: "No records found",
      logStorageNote: "The log is stored only in the browser's local storage and is not sent to the server.",
    },
    logMessages: {
      missingServerEnvVars: "Missing Supabase environment variables on server",
      creatingServerClient: "Creating server Supabase client",
      missingClientEnvVars: "Missing Supabase environment variables on client",
      creatingClientClient: "Creating client Supabase client",
      errorCreatingClient: "Error creating Supabase client",
      timeoutAvailability: "Timeout checking Supabase availability",
      supabaseQueryError: "Supabase query error: {error}",
      exceptionAvailability: "Exception checking Supabase availability",
      tablesNotExistDirect: "Tables do not exist in database (direct query check)",
      tablesExist: "Tables exist in database",
      timeoutCheckTables: "Timeout checking table existence",
      errorCheckTables: "Error checking table existence",
      timeoutCheckContent: "Timeout checking table content",
      dbInitStart: "Starting database initialization",
      tablesAlreadyExist: "Tables already exist, initialization not required",
      dbInitSuccess: "Database initialized successfully",
      dbInitException: "Exception during database initialization",
      timeoutSql: "Timeout executing SQL",
      errorDecompress: "Error decompressing data from localStorage: {key}",
      dataCorrupted: "Data in localStorage corrupted: {key}",
      errorGetLocal: "Error getting data from localStorage: {key}",
      errorSetLocal: "Error saving data to localStorage: {key}",
      gettingMatches: "Getting match list",
      supabaseAvailableGetting: "Supabase available, getting matches from database",
      matchesNotFoundInSupabase: "No matches found in Supabase",
      tablesNotExistUseLocal: "Tables don't exist in Supabase, using local storage",
      supabaseUnavailableUseLocal: "Supabase unavailable, using local storage",
      restoredFromLocal: "Restored {count} matches from localStorage",
      gotFromLocal: "Got {count} matches from localStorage",
      errorGettingMatches: "Error getting matches",
      errorProcessingKey: "Error processing key {key}",
      errorSearchLocal: "Error searching matches in localStorage",
      gettingMatchById: "Getting match by ID/code: {id}",
      matchFromCache: "Match {id} retrieved from cache",
      supabaseAvailableGettingMatch: "Supabase available, getting match from database",
      errorMatchFromSupabase: "Error getting match from Supabase: {error}",
      matchGotFromSupabase: "Match successfully retrieved from Supabase",
      initEmptySetsSupabase: "Initialized empty sets array for match from Supabase",
      playerCountriesLoaded: "Player country info loaded successfully",
      playerCountriesLoadFailed: "Failed to load player country info",
      playerCountriesError: "Error loading player country info",
      matchNotFoundSupabase: "Match not found in Supabase",
      matchFoundLocal: "Match found in local storage",
      initEmptySetsLocal: "Initialized empty sets array for match from localStorage",
      matchFoundInList: "Match found in local storage list",
      initEmptySetsList: "Initialized empty sets array for match from list",
      matchNotFoundAnywhere: "Match not found in Supabase or local storage",
      errorGettingMatch: "Error getting match: {error}",
      cleaningStorage: "Cleaning local storage: {count} matches, limit {limit}",
      deletedOldMatch: "Deleted old match from localStorage: {id}",
      errorCleaningStorage: "Error cleaning storage",
      creatingMatch: "Creating new match",
      initEmptySetsNew: "Initialized empty sets array for new match",
      supabaseAvailableSaving: "Supabase available, saving match to database",
      errorSavingSupabase: "Error saving match to Supabase: {error}",
      matchSavedSupabase: "Match saved to Supabase successfully",
      tablesNotExistSaveLocal: "Tables don't exist in Supabase, saving to local storage only",
      supabaseUnavailableSaveLocal: "Supabase unavailable, saving to local storage only",
      matchSavedLocal: "Match saved to local storage successfully",
      errorCreatingMatch: "Error creating match: {error}",
      deletingMatch: "Deleting match: {id}",
      matchNotFoundForDelete: "Match not found for deletion: {id}",
      supabaseAvailableDeleting: "Supabase available, deleting match from database",
      errorDeletingSupabase: "Error deleting match from Supabase: {error}",
      matchDeletedSupabase: "Match deleted from Supabase successfully",
      tablesNotExistDeleteLocal: "Tables don't exist in Supabase, deleting from local storage only",
      supabaseUnavailableDeleteLocal: "Supabase unavailable, deleting from local storage only",
      matchDeletedLocal: "Match deleted from local storage successfully",
      errorDeletingMatch: "Error deleting match: {error}",
      matchNotFoundForSubscribe: "Match not found for subscription: {id}",
      supabaseEventReceived: "Received Supabase event for match {id}",
      subscribeStatus: "Match {id} subscription status: {status}",
      unsubscribeMatch: "Unsubscribed from match {id} updates",
      tablesNotExistLocalSubscribe: "Tables don't exist in Supabase, using local subscription",
      supabaseUnavailableLocalSubscribe: "Supabase unavailable, using local subscription",
      checkingAvailability: "Checking Supabase availability",
      runningTestQuery: "Running test query to Supabase",
      supabaseAvailable: "Supabase available",
      errorCheckingAvailability: "Error checking Supabase availability: {error}",
      exceptionCheckingAvailability: "Exception checking Supabase availability",
      gettingAllMatches: "Getting all matches for history",
      gettingMatchByCourt: "Getting match by court number: {court}",
      invalidCourtNumber: "Invalid court number",
      failedCreateClient: "Failed to create Supabase client",
      activeMatchNotFoundSeekCompleted: "Active match on court {court} not found, searching completed",
      errorCompletedMatch: "Error getting completed match: {error}",
      matchNotFoundActiveOrCompleted: "Match not found in Supabase (neither active nor completed)",
      initEmptySetsCompleted: "Initialized empty sets array for completed match",
      gotCompletedMatchByCourt: "Got completed match by court number",
      gotMatchByCourt: "Match retrieved by court number",
      timeoutGetMatchByCourt: "Timeout getting match by court number",
      errorGetMatchByCourt: "Error getting match by court number: {error}",
      gettingOccupiedCourts: "Getting occupied courts list",
      errorOccupiedCourts: "Error getting occupied courts: {error}",
      noActiveMatchesOnCourts: "No active matches on courts",
      gotOccupiedCourts: "Got {count} occupied courts",
      timeoutOccupiedCourts: "Timeout getting occupied courts",
      failedOccupiedUseLocal: "Failed to get occupied courts from Supabase, using local data",
      errorLocalCourts: "Error getting local court data",
      gotFreeCourts: "Got {count} free courts",
      errorFreeCourts: "Error getting free courts: {error}",
      assigningMatchToCourt: "Assigning match {matchId} to court {court}",
      matchNotFound: "Match not found",
      errorAssigningCourt: "Error assigning match to court: {error}",
      matchAssignedToCourt: "Match {matchId} assigned to court {court}",
      timeoutAssigningCourt: "Timeout assigning match to court",
      freeingCourt: "Freeing court {court}",
      matchOnCourtNotFound: "Match on court not found",
      errorFreeingCourt: "Error freeing court: {error}",
      courtFreed: "Court {court} freed successfully",
      timeoutFreeingCourt: "Timeout freeing court",
      errorExecutingSql: "Error executing SQL: {error}",
      errorInitializingDb: "Error initializing database: {error}",
      sqlExecuted: "SQL query executed successfully",
      sqlQueryError: "SQL execution error",
      startConnectionTest: "Starting Supabase connection test",
      connectionTestCompleted: "Connection test completed: success",
      connectionTestFailed: "Connection test completed: failed",
      errorConnectionTest: "Error running connection test",
      checkingTablesExist: "Checking table existence",
      checkingTablesContent: "Checking table content",
      checkingDb: "Checking database",
      checkingTablesStatus: "Checking table status",
      tablesCheckResult: "Table check result",
      initDbResult: "Database initialization result",
      sqlCreateResult: "Create matches table result",
      sqlCreatePlayersResult: "Create players table result",
      matchSynced: "Match {id} synced, revision={revision}",
      syncConflict: "Sync conflict for match {id}: {reason}",
      operationDeadLetter: "Match {id} operation moved to dead-letter: {error}",
      flushQueueError: "Error flushing queue for match {id}",
      revisionColumnMissing: "Column matches.revision missing — last-writer-wins mode",
      localStorageUnavailable: "localStorage unavailable — sync running in limited mode",
      operationLogCorrupted: "Operation log corrupted or stale: {id}",
      operationLogReadError: "Failed to read operation log: {id}",
      operationLogSaveError: "Failed to save operation log (quota?): {id}",
      operationLogListError: "Failed to list operation logs",
      errorFetchPlayers: "Error fetching players from Supabase",
      errorGetPlayers: "Error getting players",
      errorAddPlayerSupabase: "Error adding player to Supabase",
      errorAddPlayer: "Error adding player",
      errorUpdatePlayerSupabase: "Error updating player in Supabase",
      errorUpdatePlayer: "Error updating player",
      errorDeletePlayerSupabase: "Error deleting player from Supabase",
      errorDeletePlayer: "Error deleting player",
      errorDeletePlayersSupabase: "Error deleting players from Supabase",
      errorDeletePlayers: "Error deleting players",
      gettingMatchServer: "Getting match by ID (server): {id}",
      matchGotServer: "Match retrieved from Supabase (server)",
      gettingMatchByCourtServer: "Getting match by court number (server): {court}",
      matchGotByCourtServer: "Match retrieved from Supabase (server)",
      vmixGetError: "Error getting vMix settings",
      vmixGetException: "Exception getting vMix settings",
      vmixGetByIdError: "Error getting vMix settings by ID: {id}",
      vmixGetByIdException: "Exception getting vMix settings by ID",
      vmixGetDefaultError: "Error getting default vMix settings",
      vmixGetDefaultException: "Exception getting default vMix settings",
      vmixResetDefaultError: "Error resetting default flag",
      vmixCreateError: "Error creating vMix settings",
      vmixCreated: "Created new vMix settings: {name}",
      vmixUpdateError: "Error updating vMix settings: {id}",
      vmixUpdated: "Updated vMix settings: {name}",
      vmixSaveException: "Exception saving vMix settings",
      vmixDeleteError: "Error deleting vMix settings: {id}",
      vmixDeleted: "Deleted vMix settings: {id}",
      vmixDeleteException: "Exception deleting vMix settings",
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
      fullscreen: "Повний екран",
      vmixOverlay: "Оверлей vMix",
      vmixSettings: "Налаштування vMix",
      checking: "Перевірка...",
      saving: "Збереження...",
      enterFullscreen: "Повний екран",
      exitFullscreen: "Вийти з повного екрану",
      continue: "Продовжити",
      updateSettings: "Оновити налаштування",
      updateSettingsDesc: "Оновити поточні налаштування",
      settingsName: "Назва налаштувань",
      settingsNamePlaceholder: "Введіть назву налаштувань...",
      useAsDefault: "Використовувати за замовчуванням",
      saveButton: "Зберегти",
      cancelButton: "Відміна",
      courtStatus: {
        matchInProgress: "Матч у процесі",
        matchInProgressDescription: "На цьому корті вже йде матч. Будь ласка, зачекайте його завершення або НАТИСНІТЬ ЧЕРВОНУ КНОПКУ ЗАВЕРШЕННЯ МАТЧУ ПРИ ВХОДІ НА КОРТ. Потім оновіть сторінку.",
        noMatch: "Корт вільний",
        noMatchDescription: "На цьому корті немає активних матчів. Ви можете почати новий матч.",
        refresh: "Оновити",
        continue: "Продовжити",
        finishMatch: "Завершити матч",
        finishMatchButton: "Завершити матч",
        finishMatchLink: "Завершити матч за посиланням",
        matchFinished: "Матч завершено",
        finishMatchError: "Помилка завершення матчу",
        matchFinishedDescription: "Матч успішно завершено",
        finishMatchErrorDescription: "Сталася помилка під час завершення матчу",
        managePlayers: "Керування гравцями",
        activeMatches: "Активні матчі",
        activeMatchesDesc: "Перегляд та керування активними матчами",
        matchHistory: "Історія матчів",
        joinMatch: "Приєднатися до матчу",
        joinMatchDesc: "Приєднатися до існуючого матчу",
        joinByCode: "Приєднатися за кодом",
        diagnostics: "Діагностика"
      }
    },
    home: {
      title: "Теніс & Падел Табло",
      subtitle: "Відстежуйте рахунок в реальному часі",
      newMatch: "Створити новий матч",
      newMatchDesc: "Налаштуйте нову гру з вибраними параметрами",
      tennis: "Теніс",
      padel: "Падел",
      managePlayers: "Управління гравцями",
      activeMatches: "Активні матчі",
      activeMatchesDesc: "Поточні та останні матчі",
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
      point: "Очко",
      player: "Гравець",
      team: "Команда",
      teamA: "Команда A",
      teamB: "Команда B",
      serve: "Подача",
      undo: "Скасувати",
      settings: "Налаштування",
      scoreCard: "Табло рахунку",
      scoreControls: "Керування рахунком",
      addPoint: "Очко",
      switchServer: "Змінити подаючого", // Ukrainian: already correct
      switchSides: "Змінити сторони",
      leftSide: "Ліва сторона",
      rightSide: "Права сторона",
      needToSwitchSides: "Необхідно змінити сторони! Зміна сторін відбудеться автоматично при наступній зміні рахунку.",
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
      matchDeleted: "Матч успішно видалено",
      matchDeleteError: "Помилка при видаленні матчу",
      noCourtAssigned: "Не призначено",
      selectCourt: "Виберіть корт",
      courtAlreadyOccupied: "Цей корт вже зайнятий",
      updateCourt: "Оновити корт",
      courtUpdated: "Корт успішно оновлено",
      courtUpdateError: "Помилка при оновленні корту",
      scoreEditing: "Редагування рахунку",
      currentSet: "поточний",
      startTiebreakManually: "Почати тай-брейк вручну",
      teamWonTiebreak: "Тай-брейк виграла команда",
      matchCode: "Код матчу",
      scoringSystem: "Система рахунку",
      classicScoring: "Класична (AD)",
      noAdScoring: "No-Ad (рівно → вирішальний м'яч)",
      fast4Scoring: "Fast4 (до 4 геймів)",
      tiebreakType: "Тип тай-брейку",
      regularTiebreak: "Звичайний (до 7)",
      championshipTiebreak: "Чемпіонський (до 10)",
      superTiebreak: "Супер-тай-брейк (замість 3-го сету)",
      tiebreakAt: "Тай-брейк при рахунку",
      selectTiebreakScore: "Виберіть рахунок для тай-брейку",
      additional: "Додатково",
      goldenGame: "Золотий гейм (Падел)",
      windbreak: "Віндбрейк (подача через гейм)",
      applySettings: "Застосувати налаштування",
      unlockMatch: "Розблокувати матч",
      endMatch: "Завершити матч",
      confirmEndMatch: "Ви впевнені, що хочете завершити матч? Ви зможете розблокувати його пізніше, якщо потрібно.",
      finishMatch: "Завершити матч",
      finishMatchButton: "Завершити матч",
      finishMatchLink: "Завершити матч за посиланням",
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
      loveAll: "рівно",
      play: "грайте",
    },
    scoreboard: {
      tennis: "Теніс",
      padel: "Падел",
      singles: "Одиночна гра",
      doubles: "Парна гра",
      matchCompleted: "Матч завершено",
      set: "Сет",
      of: "з",
      tiebreak: "Тайбрейк",
      game: "Гейм",
      leftCourtSide: "Ліва сторона корту",
      rightCourtSide: "Права сторона корту",
      currentServer: "Поточна подача",
      playerA: "Гравець A",
      playerB: "Гравець B",
      court: "Корт",
    },
    scoreboardSettings: {
      title: "Налаштування відображення",
      presets: "Готові схеми",
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
      showCurrentServer: "Показувати блок поточної подачі",
      showServerIndicator: "Показувати індикатор подачі біля імен",
      showSetsScore: "Показувати рахунок сетів",
      useCustomSizes: "Використовувати власні розміри",
      fontSize: "Загальний розмір шрифту",
      playerCellWidth: "Ширина комірки імен гравців",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      gameScoreFontSize: "Розмір шрифту рахунку в геймі",
      setsScoreFontSize: "Розмір шрифту рахунку в сетах",
      infoBlockFontSize: "Розмір шрифту інформаційних блоків",
      gameScoreTextColor: "Колір тексту рахунку в геймі",
      gameCellBgColor: "Колір фону комірки гейму",
      tiebreakCellBgColor: "Колір фону комірки тай-брейку",
      setsScoreTextColor: "Колір тексту рахунку в сетах",
      done: "Готово",
    },
    matchPage: {
      loadingMatch: "............",
      sideChange: "Зміна сторони",
      sidesSwapped: "Сторони помінялись",
      switchServer: "Змінити подаючого",
      switchSides: "Змінити сторони",
      errorTitle: "Помилка",
      createNewMatch: "Створити новий матч",
      home: "На головну",
      court: "Корт",
      share: "Поділитися",
      viewScore: "Перегляд рахунку",
      notification: "Сповіщення",
      matchTab: "Матч",
      exportImportTab: "Експорт/Імпорт",
      exportMatch: "Експорт матчу",
      exportDescription: "Скопіюйте дані матчу для збереження або передачі на інший пристрій",
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
      scoreUpdated: "Рахунок оновлено",
      linkCopied: "Посилання скопійовано в буфер обміну",
      matchCodeCopied: "Код матчу скопійовано в буфер обміну",
      matchDataCopied: "Дані матчу скопійовано в буфер обміну",
      importDataRequired: "Введіть дані для імпорту",
      matchImported: "Матч успішно імпортовано",
      importError: "Помилка при імпорті матчу. Перевірте формат даних.",
      matchDataSimplified: "Дані матчу були спрощені через обмеження сховища",
      backToMatchControl: "До управління матчем",
      invalidMatchId: "Некоректний ID матчу",
      matchNotFound: "Матч не знайдено",
      matchNotFoundOrDeleted: "Матч не знайдено або був видалений",
      errorLoadingMatch: "Помилка завантаження матчу",
      shareMatchTitle: "Рахунок тенісного матчу",
      shareMatchText: "Слідкуйте за рахунком матчу в реальному часі",
      returnToHome: "Повернутися на головну",
      matchUpdateFailed: "Не вдалося оновити матч. Спробуйте оновити сторінку.",
      matchIsOver: "Матч завершено",
      finalTiebreak: "(Фінальний тайбрейк)",
      teamWonConfirm: "Команда {team} виграла матч! Завершити матч?",
      ruleChangeNoRestart: "Зміну не можна застосувати без втрат",
      ruleChangeAffectsSet: "Зміна впливає на поточний сет",
      ruleChangeDescription: "Виберіть, як застосувати цю зміну правил.",
      applyNow: "Застосувати зараз",
      restartSet: "Перезапустити поточний сет з 0:0",
      playerFallbackTeamA: "Гравець 1, Гравець 2",
      playerFallbackTeamB: "Гравець 3, Гравець 4",
    },
    matchList: {
      loading: "Завантаження матчів...",
      error: "Помилка завантаження матчів",
      noMatches: "Немає активних матчів",
      court: "Корт",
      completed: "Завершений",
      inProgress: "В процесі",
      code: "Код",
      showingLatest: "Показано останні {{count}} матчів",
    },
    courtsList: {
      title: "Статус кортів",
      description: "Інформація про зайняті корти",
      refresh: "Оновити",
      court: "Корт",
      occupied: "Зайнятий",
      available: "Вільний",
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
      connectionDetails: "Детальна інформація про статус з'єднання з Supabase",
      connectionEstablished: "З'єднання встановлено",
      connectionMissing: "З'єднання відсутнє",
      checkNow: "Перевірити зараз",
      connectionDetailsTitle: "Деталі з'єднання:",
      possibleIssues: "Можливі причини проблем зі з'єднанням:",
      issueInternet: "Відсутнє підключення до Інтернету",
      issueCredentials: "Невірні облікові дані Supabase",
      issueServer: "Сервер Supabase недоступний",
      issueCors: "Проблеми з CORS або мережевими налаштуваннями",
      issueEnvVars: "Відсутні необхідні змінні оточення",
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
      deleteSelected: "Видалити вибраних",
      name: "Ім'я",
      country: "Країна",
      countryAbbreviation: "Абревіатура країни (ENG, UKR, ESP...)",
      selectPlayer: "Виберіть гравця",
      searchPlayer: "Пошук гравця...",
      playerNotFound: "Гравець не знайдений",
      selectAll: "Вибрати всіх",
      loadingPlayers: "Завантаження гравців...",
      emptyList: "Список гравців порожній",
      totalPlayers: "Всього гравців",
      selected: "Вибрано",
      errorAddingPlayer: "Сталася помилка при додаванні гравця",
      errorDeletingPlayers: "Сталася помилка при видаленні гравців",
      noPlayersFound: "Гравців не знайдено",
    },
    newMatch: {
      tiebreakLength10: "Tiebreak 10",
      tiebreakLength7: "Tiebreak 7",
      title: "Створення нового матчу",
      selectedCourt: "Вибраний корт",
      tennisDesc: "Налаштування тенісного матчу",
      padelDesc: "Налаштування матчу з паделу",
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
      games: "Геймів у сеті",
      tiebreak: "Тай-брейк",
      finalSetTiebreak: "Тай-брейк у вирішальному сеті",
      finalSetTiebreakLength: "Довжина тай-брейку у вирішальному сеті",
      finalSetTiebreakLengthDescription: "Оберіть довжину тай-брейку у вирішальному сеті",
      finalSetTiebreakNote: "Це налаштування впливає лише на заключний сет і не пов'язане зі звичайними тай-брейками.",
      goldenGame: "Золотий гейм (Падел)",
      windbreak: "Віндбрейк (подача через гейм)",
      format: "Формат гри",
      selectFormat: "Виберіть формат",
      singles: "Одиночна гра",
      doubles: "Парна гра",
      oneSets: "1 сет",
      twoSets: "2 сети (тай-брейк у 3-му)",
      threeSets: "3 сети",
      fiveSets: "5 сетів (Гранд-слем)",
      scoringSystem: "Система рахунку",
      classicScoring: "Класична (AD)",
      noAdScoring: "No-Ad (рівно → вирішальний м'яч)",
      fast4Scoring: "Fast4 (до 4 геймів)",
      tiebreakType: "Тип тай-брейку",
      regularTiebreak: "Звичайний (до 7)",
      championshipTiebreak: "Чемпіонський (до 10)",
      superTiebreak: "Супер-тай-брейк (замість 3-го сету)",
      tiebreakAt: "Тай-брейк при рахунку",
      selectTiebreakScore: "Виберіть рахунок для тай-брейку",
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
      allCourtsAvailable: "Всі корти вільні",
      startMatch: "Почати матч",
      selectAllPlayers: "Виберіть гравців для обох команд",
      selectAllPlayersForDoubles: "Для парної гри необхідно вибрати всіх гравців",
      courtOccupied: "Корт {{court}} вже зайнятий. Виберіть інший корт.",
      superSet: "ПРО сет до 8 геймів",
      matchRound: "Раунд матчу",
      selectMatchRound: "Виберіть раунд матчу",
      selectSets: "Виберіть раунд матчу",
      selectScoringSystem: "Виберіть раунд матчу",
      superSetDescription: "PRO set до 8 геймів",
      matchRounds: {
        none: "Не вибрано",
        final: "Фінал",
        semifinal: "Півфінал",
        quarterfinal: "Чвертьфінал",
        round16: "1/8 фіналу",
        round32: "1/16 фіналу",
        round64: "1/32 фіналу",
        round128: "1/64 фіналу",
        qualificationFinal: "Фінал кваліфікації",
        qualificationRound2: "Кваліфікація, раунд 2",
        qualificationRound1: "Кваліфікація, раунд 1",
        prequalifying: "Пре-кваліфікація",
      },
      gamesPerSet: "Кількість геймів у сеті",
      gamesStandard: "(стандарт)",
      gamesFast4: "(Fast4)",
      goldenPoint: "Золоте очко",
      goldenPointOff: "Вимк",
      goldenPointFirstDeuce: "Про - перший рівно",
      goldenPointSecondDeuce: "Аматор - другий рівно",
      goldenPointThirdDeuce: "Зірка - третій рівно",
      tiebreakPoints: "Очки тайбрейку",
      tiebreakTwoClear: "З різницею в 2 очки",
      tiebreakReceiver12: "Приймаючий обирає 1 або 2",
      tiebreakReceiver123: "Приймаючий обирає 1, 2 або 3",
      tiebreakReceiver13: "Приймаючий обирає 1 або 3",
      tiebreakSuddenDeath: "Раптова смерть",
      tiebreakToNStandard: "До {n} очок (стандарт)",
      tiebreakToNChampionship: "До {n} очок (чемпіонський)",
      tiebreakWith2Clear: "З різницею в 2 очки",
      finalSetFinishLabel: "Фінальний сет — завершення",
      finalSetGamesTiebreak7: "Гейми як зазвичай — тайбрейк до 7",
      finalSetGamesTiebreak10: "Гейми як зазвичай — тайбрейк до 10",
      finalSetMatchTiebreak7: "Без геймів — матч-тайбрейк до 7",
      finalSetMatchTiebreak10: "Без геймів — матч-тайбрейк до 10",
      finalSetGamesTo12Tiebreak7: "Гейми до 12 — тайбрейк до 7",
      finalSetGamesTo12Tiebreak10: "Гейми до 12 — тайбрейк до 10",
      finalSetNoTiebreak: "Без тайбрейку",
      setsNnormal: "{n} — звичайний",
      setsNplusTiebreak: "{n} + тайбрейк",
      selectTiebreakLength: "Виберіть довжину тайбрейку",
      hidePerSetSettings: "Сховати налаштування для кожного сету",
      showPerSetSettings: "Налаштувати для кожного сету окремо",
      setNumber: "Сет {n}",
      errorAddingPlayer: "Сталася помилка при додаванні гравця",
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
      transparentTheme: "Прозора",
      fontSize: "Розмір шрифту",
      selectFontSize: "Виберіть розмір шрифту",
      smallSize: "Малий",
      mediumSize: "Середній",
      largeSize: "Великий",
      xlargeSize: "Дуже великий",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      bgOpacity: "Прозорість фону",
      textColor: "Колір тексту",
      serveIndicatorColor: "Колір індикатора подачі",
      colorsAndGradients: "Кольори та градієнти",
      configureColorsAndGradients: "Налаштуйте кольори та градієнти для різних блоків",
      playerNamesBlock: "Блок імен гравців",
      playerNamesBgColor: "Колір фону імен гравців",
      useGradientForNames: "Використовувати градієнт для імен",
      namesGradientStartColor: "Початковий колір градієнта імен",
      namesGradientEndColor: "Кінцевий колір градієнта імен",
      countriesBlock: "Блок країн гравців",
      countriesBgColor: "Колір фону країн гравців",
      useGradientForCountries: "Використовувати градієнт для країн",
      countriesGradientStartColor: "Початковий колір градієнта країн",
      countriesGradientEndColor: "Кінцевий колір градієнта країн",
      serveIndicatorBlock: "Блок індикатора подачі",
      serveIndicatorBgColor: "Колір фону індикатора подачі",
      useGradientForServeIndicator: "Використовувати градієнт для фону індикатора подачі",
      serveIndicatorGradientStartColor: "Початковий колір градієнта фону індикатора",
      serveIndicatorGradientEndColor: "Кінцевий колір градієнта фону індикатора",
      serveIndicatorExample: "Приклад індикатора подачі",
      currentScoreBlock: "Блок поточного рахунку",
      currentScoreBgColor: "Колір фону поточного рахунку",
      useGradientForCurrentScore: "Використовувати градієнт для рахунку",
      currentScoreGradientStartColor: "Початковий колір градієнта рахунку",
      currentScoreGradientEndColor: "Кінцевий колір градієнта рахунку",
      setsScoreBlock: "Блок рахунку в сетах",
      setsBgColor: "Колір фону рахунку сетів",
      setsTextColor: "Колір тексту рахунку сетів",
      useGradientForSets: "Використовувати градієнт для рахунку в сетах",
      setsGradientStartColor: "Початковий колір градієнта рахунку в сетах",
      setsGradientEndColor: "Кінцевий колір градієнта рахунку в сетах",
      importantMomentsIndicator: "Індикатор важливих моментів",
      indicatorBgColor: "Колір фону індикатора",
      indicatorTextColor: "Колір тексту індикатора",
      useGradientForIndicator: "Використовувати градієнт для індикатора",
      indicatorGradientStartColor: "Початковий колір градієнта індикатора",
      indicatorGradientEndColor: "Кінцевий колір градієнта індикатора",
      actions: "Дії",
      previewAndUseSettings: "Попередній перегляд та використання налаштувань",
      preview: "Попередній перегляд з поточними налаштуваннями",
      openInNewWindow: "Відкрити в новому вікні",
      openInCurrentWindow: "Відкрити в поточному вікні",
      copyUrl: "Скопіювати URL",
      copying: "Копіювання...",
      saveSettings: "Зберегти налаштування",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Використовуйте цей API для отримання даних матчу у форматі JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Інструкція з використання у vMix",
      dataSourceSetup: "Налаштування Data Source у vMix:",
      titleDesignerUsage: "Використання в Title Designer:",
      titleDesignerSteps:
        'У vMix, перейдіть до "Settings" → "Data Sources"\nНатисніть "Add" та виберіть "Web"\nВставте URL API у поле "URL"\nВстановіть "Update Interval" на 1-2 секунди\nНатисніть "OK" для збереження',
      availableDataFields: "Доступні поля даних",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Загальні дані:",
      dataFormatExample: "Приклад формату даних",
      settingsSaved: "Налаштування збережено",
      errorSavingSettings: "Не вдалося зберегти налаштування",
      teamAName: "Ім'я команди A",
      teamAScore: "Рахунок команди A",
      teamAGameScore: "Поточний рахунок у геймі команди A",
      teamACurrentSet: "Поточний сет команди A",
      teamAServing: "Подача команди A",
      teamASetScores: "Рахунок у сетах команди A",
      teamBName: "Ім'я команди B",
      teamBScore: "Рахунок команди B",
      teamBGameScore: "Поточний рахунок у геймі команди B",
      teamBCurrentSet: "Поточний сет команди B",
      teamBServing: "Подача команди B",
      teamBSetScores: "Рахунок у сетах команди B",
      matchId: "ID матчу",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершено",
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
      saveSettingsDescription: "Введіть назву для налаштувань та виберіть, чи будуть вони використовуватися за замовчуванням",
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
      clickAddAndSelectWeb: 'Натисніть "Add" та виберіть "Web"',
      pasteApiUrl: 'Вставте URL API у поле "URL"',
      setUpdateInterval: 'Встановіть "Update Interval" на 1-2 секунди',
      clickOkToSave: 'Натисніть "OK" для збереження',
      createOrOpenTitle: "Створіть новий Title або відкрийте існуючий",
      addTextFields: "Додайте текстові поля для відображення даних",
      inTextFieldPropertiesSelectDataBinding: 'У властивостях текстового поля виберіть "Data Binding"',
      selectDataSourceAndField: 'Виберіть вашу Data Source та потрібне поле (наприклад, "teamA_name")',
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
      loadingSettings: ".........",
      backgroundOpacity: "Прозорість фону",
      accentColor: "Колір акценту",
      previewWithCurrentSettings: "Попередній перегляд з поточними налаштуваннями",
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
      transparentTheme: "Прозора",
      fontSize: "Розмір шрифту",
      selectFontSize: "Виберіть розмір шрифту",
      smallSize: "Малий",
      mediumSize: "Середній",
      largeSize: "Великий",
      xlargeSize: "Дуже великий",
      playerNamesFontSize: "Розмір шрифту імен гравців",
      bgOpacity: "Прозорість фону",
      textColor: "Колір тексту",
      serveIndicatorColor: "Колір індикатора подачі",
      colorsAndGradients: "Кольори та градієнти",
      configureColorsAndGradients: "Налаштуйте кольори та градієнти для різних блоків",
      playerNamesBlock: "Блок імен гравців",
      playerNamesBgColor: "Колір фону імен гравців",
      useGradientForNames: "Використовувати градієнт для імен",
      namesGradientStartColor: "Початковий колір градієнта імен",
      namesGradientEndColor: "Кінцевий колір градієнта імен",
      countriesBlock: "Блок країн гравців",
      countriesBgColor: "Колір фону країн гравців",
      useGradientForCountries: "Використовувати градієнт для країн",
      countriesGradientStartColor: "Початковий колір градієнта країн",
      countriesGradientEndColor: "Кінцевий колір градієнта країн",
      serveIndicatorBlock: "Блок індикатора подачі",
      serveIndicatorBgColor: "Колір фону індикатора подачі",
      useGradientForServeIndicator: "Використовувати градієнт для фону індикатора подачі",
      serveIndicatorGradientStartColor: "Початковий колір градієнта фону індикатора",
      serveIndicatorGradientEndColor: "Кінцевий колір градієнта фону індикатора",
      serveIndicatorExample: "Приклад індикатора подачі",
      currentScoreBlock: "Блок поточного рахунку",
      currentScoreBgColor: "Колір фону поточного рахунку",
      useGradientForCurrentScore: "Використовувати градієнт для рахунку",
      currentScoreGradientStartColor: "Початковий колір градієнта рахунку",
      currentScoreGradientEndColor: "Кінцевий колір градієнта рахунку",
      setsScoreBlock: "Блок рахунку в сетах",
      setsBgColor: "Колір фону рахунку сетів",
      setsTextColor: "Колір тексту рахунку сетів",
      useGradientForSets: "Використовувати градієнт для рахунку в сетах",
      setsGradientStartColor: "Початковий колір градієнта рахунку в сетах",
      setsGradientEndColor: "Кінцевий колір градієнта рахунку в сетах",
      importantMomentsIndicator: "Індикатор важливих моментів",
      indicatorBgColor: "Колір фону індикатора",
      indicatorTextColor: "Колір тексту індикатора",
      useGradientForIndicator: "Використовувати градієнт для індикатора",
      indicatorGradientStartColor: "Початковий колір градієнта індикатора",
      indicatorGradientEndColor: "Кінцевий колір градієнта індикатора",
      actions: "Дії",
      previewAndUseSettings: "Попередній перегляд та використання налаштувань",
      preview: "Попередній перегляд з поточними налаштуваннями",
      openInNewWindow: "Відкрити в новому вікні",
      openInCurrentWindow: "Відкрити в поточному вікні",
      copyUrl: "Скопіювати URL",
      copying: "Копіювання...",
      saveSettings: "Зберегти налаштування",
      jsonApiForVmix: "JSON API для vMix",
      useApiForVmixData: "Використовуйте цей API для отримання даних матчу у форматі JSON",
      jsonApiUrl: "URL для JSON API",
      instructionsForVmix: "Інструкція з використання у vMix",
      dataSourceSetup: "Налаштування Data Source у vMix:",
      dataSourceSteps: "Кроки налаштування Data Source:",
      titleDesignerUsage: "Використання в Title Designer:",
      titleDesignerSteps:
        'У vMix, перейдіть до "Settings" → "Data Sources"\nНатисніть "Add" та виберіть "Web"\nВставте URL API у поле "URL"\nВстановіть "Update Interval" на 1-2 секунди\nНатисніть "OK" для збереження',
      availableDataFields: "Доступні поля даних",
      teamA: "Команда A:",
      teamB: "Команда B:",
      generalData: "Загальні дані:",
      dataFormatExample: "Приклад формату даних",
      settingsSaved: "Налаштування збережено",
      errorSavingSettings: "Не вдалося зберегти налаштування",
      loadingSettings: "..........",
      teamAName: "Ім'я команди A",
      teamAScore: "Рахунок команди A",
      teamAGameScore: "Поточний рахунок у геймі команди A",
      teamACurrentSet: "Поточний сет команди A",
      teamAServing: "Подача команди A",
      teamASetScores: "Рахунок у сетах команди A",
      teamBName: "Ім'я команди B",
      teamBScore: "Рахунок команди B",
      teamBGameScore: "Поточний рахунок у геймі команди B",
      teamBCurrentSet: "Поточний сет команди B",
      teamBServing: "Подача команди B",
      teamBSetScores: "Рахунок у сетах команди B",
      matchId: "ID матчу",
      isTiebreak: "Тай-брейк",
      isCompleted: "Матч завершено",
      winner: "Переможець",
      updateTime: "Час оновлення",
      copyJsonApiUrl: "Скопіювати URL JSON API",
      showPlayerNames: "Показувати імена гравців",
      showCurrentPoints: "Показувати поточні очки",
      showSetsScore: "Показувати рахунок сетів",
      showServer: "Показувати подаючого",
      showCountries: "Показувати країни",
      savedSettings: "Збережені налаштування",
      selectSaveOrDeleteSettings: "Виберіть, збережіть або видаліть налаштування vMix",
      saveSettingsDialog: "Збереження налаштувань vMix",
      saveSettingsDescription: "Введіть назву для налаштувань та виберіть, чи будуть вони використовуватися за замовчуванням",
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
    feedImport: {
      importFromTournament: "Імпорт з турніру",
      selectPlatform: "Виберіть платформу",
      selectTournament: "Виберіть турнір",
      selectLeague: "Виберіть лігу",
      selectMode: "Що імпортувати?",
      modeMatch: "Вибрати матч",
      modePlayers: "Вибрати гравців",
      selectCategory: "Виберіть категорію",
      selectMatch: "Виберіть матч",
      runningNow: "Триває зараз",
      league: "Ліга",
      noTournaments: "Немає актуальних турнірів",
      noMatches: "Немає матчів у цій категорії",
      noPlayers: "Склад ще не опубліковано",
      matchLoaded: "Матч завантажено з турніру",
      playersImported: "Додано гравців: {count}",
      loadError: "Не вдалося завантажити дані фіду",
      refresh: "Оновити",
      search: "Пошук...",
      selectAll: "Вибрати всіх",
      import: "Імпортувати",
      changePlatform: "Змінити платформу",
      changeTournament: "Змінити турнір",
      startOver: "На початок",
    },
    debugPage: {
      backToHome: "На головну",
      tabDatabase: "База даних",
      tabConnection: "З'єднання",
      tabErrorLogs: "Журнал помилок",
      connectionDiagnostics: "Діагностика з'єднання з базою даних",
      runConnectionTest: "Запустити тест з'єднання",
      runningTest: "Виконання тесту...",
      testResults: "Результати тесту:",
      checkingDatabase: "Перевірка бази даних...",
      tableExists: "Таблиця існує",
      tableNotExists: "Таблиця не існує",
      matchesTable: "Таблиця матчів (matches)",
      playersTable: "Таблиця гравців (players)",
      tablesContent: "Вміст таблиць:",
      playersLabel: "Гравці",
      matchesLabel: "Матчі",
      playersEmpty: "Таблиця гравців порожня",
      matchesEmpty: "Таблиця матчів порожня",
      tablesNotCreated: "Таблиці не створені",
      tablesNotCreatedDesc: "Для роботи додатку необхідно створити таблиці в базі даних Supabase. Перейдіть на вкладку «База даних» для ініціалізації.",
      errorTitle: "Помилка",
      checkTablesError: "Не вдалося перевірити статус таблиць. Перевірте з'єднання з Supabase.",
      checkDatabase: "Перевірити базу даних",
      checkingDatabaseStatus: "Перевірка статусу таблиць...",
      dbInitialization: "Ініціалізація бази даних",
      checkingTablesStatus: "Перевірка статусу таблиць...",
      tablesNotCreatedInit: "Таблиці не створені",
      tablesNotCreatedInitDesc: "Для роботи додатку необхідно створити таблиці в базі даних Supabase. Ви можете використати автоматичну ініціалізацію або створити таблиці вручну.",
      successTitle: "Успіх",
      errorTitleShort: "Помилка",
      dbInitializedSuccess: "Базу даних успішно ініціалізовано",
      dbInitError: "Помилка при ініціалізації бази даних",
      sqlExecutedSuccess: "SQL виконано успішно",
      sqlExecutionError: "Помилка виконання SQL",
      sqlQuerySuccess: "SQL-запит успішно виконано",
      sqlQueryError: "Помилка",
      tabAutoInit: "Автоматична ініціалізація",
      tabManualCreation: "Ручне створення",
      tabSqlScript: "SQL-скрипт",
      tabCustomSql: "Свій SQL",
      autoInitDescription: "Натисніть кнопку нижче, щоб автоматично створити необхідні таблиці в базі даних Supabase. Цей метод вимагає наявності функції exec_sql у вашій базі даних.",
      initializeDatabase: "Ініціалізувати базу даних",
      initializing: "Ініціалізація...",
      tablesAlreadyCreated: "Таблиці вже створені",
      manualCreationDescription: "Створіть таблиці окремо, якщо автоматична ініціалізація не працює.",
      createMatchesTable: "Створити таблицю matches",
      createPlayersTable: "Створити таблицю players",
      creatingTable: "Створення таблиці...",
      matchesTableCreated: "Таблиця matches вже створена",
      playersTableCreated: "Таблиця players вже створена",
      sqlScriptDescription: "Ви також можете виконати цей SQL-скрипт вручну в SQL-редакторі Supabase:",
      customSqlDescription: "Виконайте довільний SQL-запит:",
      enterSqlPlaceholder: "Введіть SQL-запит...",
      executeSql: "Виконати SQL",
      executing: "Виконання...",
      checkTablesStatus: "Перевірити статус таблиць",
      errorLogTitle: "Журнал помилок та подій",
      refreshBtn: "Оновити",
      exportBtn: "Експорт",
      clearBtn: "Очистити",
      clearConfirm: "Ви впевнені, що хочете очистити журнал помилок?",
      filterAll: "Всі",
      filterErrors: "Помилки",
      filterWarnings: "Попередження",
      filterInfo: "Інформація",
      filterDebug: "Налагодження",
      loadingLog: "Завантаження журналу...",
      noRecordsFound: "Записи не знайдені",
      logStorageNote: "Журнал зберігається лише в локальному сховищі браузера і не надсилається на сервер.",
    },
    logMessages: {
      missingServerEnvVars: "Відсутні змінні оточення для Supabase на сервері",
      creatingServerClient: "Створення серверного клієнта Supabase",
      missingClientEnvVars: "Відсутні змінні оточення для Supabase на клієнті",
      creatingClientClient: "Створення клієнтського клієнта Supabase",
      errorCreatingClient: "Помилка при створенні клієнта Supabase",
      timeoutAvailability: "Таймаут при перевірці доступності Supabase",
      supabaseQueryError: "Помилка запиту до Supabase: {error}",
      exceptionAvailability: "Виняток при перевірці доступності Supabase",
      tablesNotExistDirect: "Таблиці в базі даних не існують (перевірка через прямі запити)",
      tablesExist: "Таблиці в базі даних існують",
      timeoutCheckTables: "Таймаут при перевірці існування таблиць",
      errorCheckTables: "Помилка при перевірці існування таблиць",
      timeoutCheckContent: "Таймаут при перевірці вмісту таблиць",
      dbInitStart: "Початок ініціалізації бази даних",
      tablesAlreadyExist: "Таблиці вже існують, ініціалізація не потрібна",
      dbInitSuccess: "Базу даних успішно ініціалізовано",
      dbInitException: "Виняток при ініціалізації бази даних",
      timeoutSql: "Таймаут при виконанні SQL",
      errorDecompress: "Помилка при розпакуванні даних з localStorage: {key}",
      dataCorrupted: "Дані в localStorage пошкоджено: {key}",
      errorGetLocal: "Помилка при отриманні даних з localStorage: {key}",
      errorSetLocal: "Помилка при збереженні даних в localStorage: {key}",
      gettingMatches: "Отримання списку матчів",
      supabaseAvailableGetting: "Supabase доступний, отримуємо матчі з бази даних",
      matchesNotFoundInSupabase: "Матчі в Supabase не знайдені",
      tablesNotExistUseLocal: "Таблиці в Supabase не існують, використовуємо локальне сховище",
      supabaseUnavailableUseLocal: "Supabase недоступний, використовуємо локальне сховище",
      restoredFromLocal: "Відновлено {count} матчів з localStorage",
      gotFromLocal: "Отримано {count} матчів з localStorage",
      errorGettingMatches: "Помилка при отриманні матчів",
      errorProcessingKey: "Помилка при обробці ключа {key}",
      errorSearchLocal: "Помилка при пошуку матчів в localStorage",
      gettingMatchById: "Отримання матчу по ID/коду: {id}",
      matchFromCache: "Матч {id} отримано з кешу",
      supabaseAvailableGettingMatch: "Supabase доступний, отримуємо матч з бази даних",
      errorMatchFromSupabase: "Помилка при отриманні матчу з Supabase: {error}",
      matchGotFromSupabase: "Матч успішно отримано з Supabase",
      initEmptySetsSupabase: "Ініціалізовано порожній масив sets для матчу з Supabase",
      playerCountriesLoaded: "Інформацію про країни гравців завантажено",
      playerCountriesLoadFailed: "Не вдалося завантажити інформацію про країни гравців",
      playerCountriesError: "Помилка при завантаженні інформації про країни гравців",
      matchNotFoundSupabase: "Матч не знайдено в Supabase",
      matchFoundLocal: "Матч знайдено в локальному сховищі",
      initEmptySetsLocal: "Ініціалізовано порожній масив sets для матчу з localStorage",
      matchFoundInList: "Матч знайдено в загальному списку локального сховища",
      initEmptySetsList: "Ініціалізовано порожній масив sets для матчу зі списку",
      matchNotFoundAnywhere: "Матч не знайдено ні в Supabase, ні в локальному сховищі",
      errorGettingMatch: "Помилка при отриманні матчу: {error}",
      cleaningStorage: "Очищення локального сховища: {count} матчів, ліміт {limit}",
      deletedOldMatch: "Видалено старий матч з localStorage: {id}",
      errorCleaningStorage: "Помилка при очищенні сховища",
      creatingMatch: "Створення нового матчу",
      initEmptySetsNew: "Ініціалізовано порожній масив sets для нового матчу",
      supabaseAvailableSaving: "Supabase доступний, зберігаємо матч в базу даних",
      errorSavingSupabase: "Помилка при збереженні матчу в Supabase: {error}",
      matchSavedSupabase: "Матч успішно збережено в Supabase",
      tablesNotExistSaveLocal: "Таблиці в Supabase не існують, зберігаємо лише в локальне сховище",
      supabaseUnavailableSaveLocal: "Supabase недоступний, зберігаємо лише в локальне сховище",
      matchSavedLocal: "Матч успішно збережено в локальне сховище",
      errorCreatingMatch: "Помилка при створенні матчу: {error}",
      deletingMatch: "Видалення матчу: {id}",
      matchNotFoundForDelete: "Матч не знайдено для видалення: {id}",
      supabaseAvailableDeleting: "Supabase доступний, видаляємо матч з бази даних",
      errorDeletingSupabase: "Помилка при видаленні матчу з Supabase: {error}",
      matchDeletedSupabase: "Матч успішно видалено з Supabase",
      tablesNotExistDeleteLocal: "Таблиці в Supabase не існують, видаляємо лише з локального сховища",
      supabaseUnavailableDeleteLocal: "Supabase недоступний, видаляємо лише з локального сховища",
      matchDeletedLocal: "Матч успішно видалено з локального сховища",
      errorDeletingMatch: "Помилка при видаленні матчу: {error}",
      matchNotFoundForSubscribe: "Матч не знайдено для підписки: {id}",
      supabaseEventReceived: "Отримано подію Supabase для матчу {id}",
      subscribeStatus: "Статус підписки на матч {id}: {status}",
      unsubscribeMatch: "Відписка від оновлень матчу {id}",
      tablesNotExistLocalSubscribe: "Таблиці в Supabase не існують, використовуємо локальну підписку",
      supabaseUnavailableLocalSubscribe: "Supabase недоступний, використовуємо локальну підписку",
      checkingAvailability: "Перевірка доступності Supabase",
      runningTestQuery: "Виконання тестового запиту до Supabase",
      supabaseAvailable: "Supabase доступний",
      errorCheckingAvailability: "Помилка при перевірці доступності Supabase: {error}",
      exceptionCheckingAvailability: "Виняток при перевірці доступності Supabase",
      gettingAllMatches: "Отримання всіх матчів для історії",
      gettingMatchByCourt: "Отримання матчу за номером корту: {court}",
      invalidCourtNumber: "Некоректний номер корту",
      failedCreateClient: "Не вдалося створити клієнт Supabase",
      activeMatchNotFoundSeekCompleted: "Активний матч на корті {court} не знайдено, шукаємо завершений",
      errorCompletedMatch: "Помилка при отриманні завершеного матчу: {error}",
      matchNotFoundActiveOrCompleted: "Матч не знайдено в Supabase (ні активний, ні завершений)",
      initEmptySetsCompleted: "Ініціалізовано порожній масив sets для завершеного матчу",
      gotCompletedMatchByCourt: "Отримано завершений матч за номером корту",
      gotMatchByCourt: "Матч успішно отримано за номером корту",
      timeoutGetMatchByCourt: "Таймаут при отриманні матчу за номером корту",
      errorGetMatchByCourt: "Помилка при отриманні матчу за номером корту: {error}",
      gettingOccupiedCourts: "Отримання списку зайнятих кортів",
      errorOccupiedCourts: "Помилка при отриманні списку зайнятих кортів: {error}",
      noActiveMatchesOnCourts: "Немає активних матчів на кортах",
      gotOccupiedCourts: "Отримано {count} зайнятих кортів",
      timeoutOccupiedCourts: "Таймаут при отриманні списку зайнятих кортів",
      failedOccupiedUseLocal: "Не вдалося отримати зайняті корти з Supabase, використовуємо локальні дані",
      errorLocalCourts: "Помилка при отриманні локальних даних про корти",
      gotFreeCourts: "Отримано {count} вільних кортів",
      errorFreeCourts: "Помилка при отриманні списку вільних кортів: {error}",
      assigningMatchToCourt: "Призначення матчу {matchId} на корт {court}",
      matchNotFound: "Матч не знайдено",
      errorAssigningCourt: "Помилка при призначенні матчу на корт: {error}",
      matchAssignedToCourt: "Матч {matchId} успішно призначено на корт {court}",
      timeoutAssigningCourt: "Таймаут при призначенні матчу на корт",
      freeingCourt: "Звільнення корту {court}",
      matchOnCourtNotFound: "Матч на корті не знайдено",
      errorFreeingCourt: "Помилка при звільненні корту: {error}",
      courtFreed: "Корт {court} успішно звільнено",
      timeoutFreeingCourt: "Таймаут при звільненні корту",
      errorExecutingSql: "Помилка при виконанні SQL: {error}",
      errorInitializingDb: "Помилка при ініціалізації бази даних: {error}",
      sqlExecuted: "SQL-запит успішно виконано",
      sqlQueryError: "Помилка виконання SQL",
      startConnectionTest: "Запуск тесту з'єднання з Supabase",
      connectionTestCompleted: "Тест з'єднання завершено: успішно",
      connectionTestFailed: "Тест з'єднання завершено: невдало",
      errorConnectionTest: "Помилка при виконанні тесту з'єднання",
      checkingTablesExist: "Перевірка існування таблиць",
      checkingTablesContent: "Перевірка вмісту таблиць",
      checkingDb: "Перевірка бази даних",
      checkingTablesStatus: "Перевірка статусу таблиць",
      tablesCheckResult: "Результат перевірки таблиць",
      initDbResult: "Результат ініціалізації бази даних",
      sqlCreateResult: "Результат створення таблиці matches",
      sqlCreatePlayersResult: "Результат створення таблиці players",
      matchSynced: "Матч {id} синхронізовано, revision={revision}",
      syncConflict: "Конфлікт синхронізації матчу {id}: {reason}",
      operationDeadLetter: "Операцію матчу {id} переміщено до dead-letter: {error}",
      flushQueueError: "Помилка зливу черги матчу {id}",
      revisionColumnMissing: "Колонку matches.revision відсутньо — режим last-writer-wins",
      localStorageUnavailable: "localStorage недоступний — синхронізація працює в обмеженому режимі",
      operationLogCorrupted: "Журнал операцій пошкоджено або застаріло: {id}",
      operationLogReadError: "Не вдалося прочитати журнал операцій: {id}",
      operationLogSaveError: "Не вдалося зберегти журнал операцій (квота?): {id}",
      operationLogListError: "Не вдалося перерахувати журнали операцій",
      errorFetchPlayers: "Помилка при отриманні гравців з Supabase",
      errorGetPlayers: "Помилка при отриманні гравців",
      errorAddPlayerSupabase: "Помилка при додаванні гравця в Supabase",
      errorAddPlayer: "Помилка при додаванні гравця",
      errorUpdatePlayerSupabase: "Помилка при оновленні гравця в Supabase",
      errorUpdatePlayer: "Помилка при оновленні гравця",
      errorDeletePlayerSupabase: "Помилка при видаленні гравця з Supabase",
      errorDeletePlayer: "Помилка при видаленні гравця",
      errorDeletePlayersSupabase: "Помилка при видаленні гравців з Supabase",
      errorDeletePlayers: "Помилка при видаленні гравців",
      gettingMatchServer: "Отримання матчу по ID (сервер): {id}",
      matchGotServer: "Матч успішно отримано з Supabase (сервер)",
      gettingMatchByCourtServer: "Отримання матчу за номером корту (сервер): {court}",
      matchGotByCourtServer: "Матч успішно отримано з Supabase (сервер)",
      vmixGetError: "Помилка при отриманні налаштувань vMix",
      vmixGetException: "Виняток при отриманні налаштувань vMix",
      vmixGetByIdError: "Помилка при отриманні налаштувань vMix по ID: {id}",
      vmixGetByIdException: "Виняток при отриманні налаштувань vMix по ID",
      vmixGetDefaultError: "Помилка при отриманні налаштувань vMix за замовчуванням",
      vmixGetDefaultException: "Виняток при отриманні налаштувань vMix за замовчуванням",
      vmixResetDefaultError: "Помилка при скиданні прапорця 'за замовчуванням'",
      vmixCreateError: "Помилка при створенні налаштувань vMix",
      vmixCreated: "Створено нові налаштування vMix: {name}",
      vmixUpdateError: "Помилка при оновленні налаштувань vMix: {id}",
      vmixUpdated: "Оновлено налаштування vMix: {name}",
      vmixSaveException: "Виняток при збереженні налаштувань vMix",
      vmixDeleteError: "Помилка при видаленні налаштувань vMix: {id}",
      vmixDeleted: "Видалено налаштування vMix: {id}",
      vmixDeleteException: "Виняток при видаленні налаштувань vMix",
    },
  },
}
