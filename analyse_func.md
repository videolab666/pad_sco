# Анализ: Функции APK "Padel v4.60" (SCORE TENNIS), отсутствующие в веб-приложении

---

## 1. ДОПОЛНИТЕЛЬНЫЕ ВИДЫ СПОРТА

### 1.1 Squash (сквош) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `SquashModel` | Полная модель подсчёта очков для сквоша | Высокий |
| English Scoring (handout) | Очко только на своей подаче, при потере — смена подающего | Высокий |
| PAR (Point-a-Rally) | Очко любому игроку, независимо от подачи | Высокий |
| `handout()` смена подающего | Смена сервера при потере розыгрыша (English scoring) | Высокий |
| Настройка порога гейма (11 или 15) | Гейм до 11 или до 15 очков | Высокий |
| Sudden Death | Вариант завершения гейма без преимущества в 2 очка | Средний |
| `showChangeSidesMessageInGame` = false | Нет смены сторон внутри гейма (особенность сквоша) | Средний |

### 1.2 Table Tennis (настольный теннис) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `TabletennisModel` | Полная модель подсчёта для настольного тенниса | Высокий |
| NrOfServesPerPlayer | Настраиваемое количество подач подряд (обычно 2) | Высокий |
| Авто-смена при 10-10 | Переход на 1 подачу при тай-брейке | Высокий |
| **Expedite Mode** | Автоматический ускоренный режим; смена подачи каждое очко | Высокий |
| `isInExpedite()` | Определение, активен ли Expedite, с индикатором "X" | Средний |
| `isTowelingDownScore` | Пауза для вытирания каждые N очков | Низкий |
| Лучший из 7 геймов | 4 гейма для победы в матче | Высокий |
| `changeInitialServer` | Специальная логика смены начального подающего | Средний |

### 1.3 Badminton (бадминтон) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `BadmintonModel` (на основе базовой модели) | Подсчёт для бадминтона | Высокий |
| English Scoring для бадминтона | Аналогично сквошу, handout при потере подачи | Средний |
| Новые правила подачи (1 подача) | Современные правила: 1 подача, при ошибке — handover | Высокий |
| Гейм до 21 + 2 преимущества | Стандартный формат бадминтона | Высокий |
| Усиление до 30 очков | Максимум 30 очков в гейме (при 29-29) | Средний |
| Смена сторон при 11 в решающем | Дополнительная смена сторон в 3-м гейме при счёте 11 | Средний |

### 1.4 Racketlon (ракетлон) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `RacketlonModel` | Уникальная модель мульти-спорта | Средний |
| 4 дисциплины в одном матче | TT → Badminton → Squash → Tennis | Средний |
| `getSportForGame(int)` | Циклическое переключение спорта между геймами | Средний |
| Динамический подсчёт матча | Сложная логика: match ball с учётом оставшихся дисциплин | Средний |
| `getPointsDiff(true)` | Разница очков с учётом оставшихся `(4 - gameNr) * 21` | Средний |
| Настраиваемый порядок дисциплин | `setDiscipline()` — пользователь меняет порядок | Низкий |
| Специфичная последовательность подач | TT/Badminton/Tennis → A1B1A2B2, Squash → A1B1A1B1 | Средний |

### 1.5 Racquetball (ракетбол) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `RacquetballModel` | Полная модель подсчёта для ракетбола | Средний |
| English Scoring по умолчанию | `setEnglishScoring(true)` — очко только на своей подаче | Средний |
| Лучший из 3 геймов | 2 гейма для победы | Средний |
| До 15 очков (до 11 в решающем) | `getNrOfPointsToWinGame()` = 15, решающий гейм = 11 | Средний |
| Hand-In/Hand-Out Scoring | Флаг `useHandInHandOutScoring` | Средний |

---

## 2. ПРАВИЛА ПОДСЧЁТА (Padel/Tennis) — ЧАСТИЧНО ОТСУТСТВУЕТ

### 2.1 Golden Point — полностью покрыто
| Функция APK | Статус в веб-приложении |
|---|---|
| None | ✅ Реализовано |
| First Deuce | ✅ Реализовано |
| Second Deuce | ✅ Реализовано |
| Third Deuce | ✅ Реализовано |

### 2.2 FinalSetFinish — полностью покрыто
| Вариант APK | Статус в веб-приложении |
|---|---|
| TieBreakTo7 | ✅ `standard-7` |
| TieBreakTo10 | ✅ `standard-10` |
| NoGames_TieBreakTo7 | ✅ `match-tiebreak-7` |
| NoGames_TieBreakTo10 | ✅ `match-tiebreak-10` |
| GamesTo12ThenTieBreakTo7 | ✅ `games-to-12-7` |
| GamesTo12ThenTieBreakTo10 | ✅ `games-to-12-10` |
| NoTiebreak (unlimited) | ✅ `no-tiebreak` |

### 2.3 TieBreakFormat — ЧАСТИЧНО ОТСУТСТВУЕТ
| Формат APK | Описание | Статус |
|---|---|---|
| TwoClearPoints | Выигрыш с преимуществом 2 | ✅ Реализовано |
| SuddenDeath | Выигрыш без преимущества | ✅ Реализовано |
| SelectOneOrTwo | Выбор 1 или 2 очка преимущества | ❌ ОТСУТСТВУЕТ |
| SelectOneTwoOrThree | Выбор 1, 2 или 3 очка преимущества | ❌ ОТСУТСТВУЕТ |
| SelectOneOrThree | Выбор 1 или 3 очка преимущества | ❌ ОТСУТСТВУЕТ |

### 2.4 New Balls (новые мячи) — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `NewBalls` enum | 4 режима: AfterFirst7ThenEach9, AfterFirst9ThenEach11, AfterFirst11ThenEach13, BeforeSet3 | Средний |
| `newBallsInXgames()` | Вычисление, через сколько геймов замена | Средний |
| `m_iLastBallChangeOccurredAtStartOfGame` | Отслеживание последней замены | Средний |
| Уведомление о новых мячах | Напоминание судье заменить мячи | Средний |
| Событие `OnSetBallChange` | Listener для UI-уведомления | Средний |

### 2.5 Handicap — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `HandicapFormat` enum | None, SameForAllGames, DifferentForAllGames | Средний |
| `m_deviatingStartScoreOfGames` | Стартовые очки гейма при гандикапе | Средний |
| Поправка отображения счёта | `Correcting score for handicap` при показе | Средний |

### 2.6 Настройки сверх текущих
| Параметр APK | Статус |
|---|---|
| `nrOfGamesToWinSet` (1-12) | ✅ Реализовано |
| `nrOfSetsToWinMatch` (1-5) | ✅ Реализовано |
| `startTiebreakOneGameEarly` | ❌ ОТСУТСТВУЕТ (но есть кастомные настройки) |
| `playAllGames` (доигрывать все геймы) | ❌ ОТСУТСТВУЕТ |

---

## 3. СИСТЕМА ТАЙМЕРОВ — ОТСУТСТВУЕТ ПОЛНОСТЬЮ

### 3.1 Таймеры матча
| Тип таймера APK | Ключ настроек | По умолчанию | Описание | Приоритет |
|---|---|---|---|---|
| Warmup | `timerWarmup` | 240 сек (4 мин) | Разминка перед матчем | Высокий |
| UntilStartOfFirstGame | `timerPauseBeforeFirstGame` | 60 сек | Пауза перед первым геймом | Средний |
| UntilStartOfNextGame | `timerPauseBetweenGames` | 120 сек (2 мин) | Пауза между геймами | Средний |
| SelfInflictedInjury | `timerSelfInflictedInjury` | 180 сек (3 мин) | Таймер собственной травмы | Средний |
| SelfInflictedBloodInjury | `timerSelfInflictedBloodInjury` | 300 сек (5 мин) | Таймер кровавой травмы | Средний |
| ContributedInjury | `timerContributedInjury` | 900 сек (15 мин) | Таймер обоюдной травмы | Средний |
| OpponentInflictedInjury | `timerOpponentInflictedInjury` | 900 сек (15 мин) | Таймер травмы от соперника | Средний |
| TowelingDown | `timerTowelingDown` | 60 сек | Пауза для вытирания | Низкий |
| Timeout | `timerTimeout` | 60 сек | Тайм-аут игрока | Средний |

### 3.2 Варианты отображения таймеров
| Режим | Описание | Приоритет |
|---|---|---|
| Popup | Всплывающее окно | Средний |
| Inline | Встроенный в табло | Средний |
| FullScreen | Полноэкранный таймер | Средний |
| Notification | Уведомление в статус-баре | Низкий |

### 3.3 Типы view таймеров
| Класс | Назначение |
|---|---|
| `WarmupTimerView` | Экран разминки |
| `PauseTimerView` | Пауза между геймами |
| `GamePausedTimerView` | Пауза в гейме |
| `InjuryTimerView` | Таймер травмы |
| `TwoTimerView` | Два таймера одновременно |
| `SBTimerView` | Базовый таймер |
| `FullScreenTimer` | Полноэкранный на ChromeCast |

---

## 4. TIMING / ХРОНОМЕТРАЖ — ОТСУТСТВУЕТ ПОЛНОСТЬЮ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `GameTiming` класс | Отслеживание начала/конца каждого гейма | Высокий |
| `start` / `end` timestamps | Миллисекунды для каждого гейма | Высокий |
| `scoreTimings` — секунды от начала | Время каждого очка относительно начала гейма | Высокий |
| Коррекция тайминга | Если первый розыгрыш через <30 сек после конца предыдущего гейма | Средний |
| `getDurationInMinutes()` | Общая длительность матча | Высокий |
| `getDuration()` | Длительность в миллисекундах | Высокий |
| `getSetDuration(int)` | Длительность конкретного сета | Средний |
| `getMatchStart()` | Время начала матча | Высокий |
| `getSetStart(int)` | Время начала конкретного сета | Средний |
| `getTimes()` — список длительностей сетов | Для GSM модели | Средний |
| `getGameTimes()` — список длительностей геймов | Для GSM модели | Средний |

---

## 5. STATISTICS / СТАТИСТИКА — ОТСУТСТВУЕТ ПОЛНОСТЬЮ

### 5.1 Rally-End Statistics (детальная статистика)
| Функция APK | Описание | Приоритет |
|---|---|---|
| `m_rallyEndStatistics` | `List<JSONArray>` — статистика по геймам | Средний |
| `m_rallyEndStatsGIP` | Статистика текущего гейма | Средний |
| `recordRallyEndStatsAfterEachScore` | Автозапись после каждого розыгрыша | Средний |

### 5.2 Категории статистики (EnumSet `RallyEndStatsPrefs`)
| Категория | Значения | Описание |
|---|---|---|
| `RacketSide` | Forehand, Backhand | Сторона ракетки |
| `StrikePosition` | Front, Volley, Back, Serve | Позиция удара |
| `BallDirection` | Straight, Cross, Boast | Направление мяча |
| `BallTrajectory` | Length, Drop, Lob | Траектория мяча |
| `RallyEnd` | Winner, Error | Исход розыгрыша |

### 5.3 Отображение статистики
| Компонент | Описание | Приоритет |
|---|---|---|
| `MatchStatisticsView` | Таблица Winner/Error по категориям | Средний |
| `MatchHistoryView` | Полная история розыгрышей | Средний |
| `GameGraphView` | Визуальный график хода счёта | Средний |
| `MatchCallsView` | История судейских решений | Средний |

---

## 6. POWER PLAY — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `m_maxNrOfPowerPlays` | Лимит Power Play на матч (по умолчанию 2) | Средний |
| `markNextRallyAsPowerPlayFor()` | Активация Power Play для следующего розыгрыша | Средний |
| `getNrOfPowerPlaysLeftFor()` | Остаток Power Play у игрока | Средний |
| PowerPlay CashIn / Waste | PPW — выиграл на PP, PPL — проиграл PP | Средний |
| Нельзя активировать на Game Ball | Проверка `isPossibleGameBallFor()` | Средний |
| Визуальный индикатор PP | Иконка на табло | Средний |

---

## 7. CONDUCT / НАРУШЕНИЯ — ОТСУТСТВУЕТ

### 7.1 Типы нарушений (`Call` enum)
| Код | Вызов | Влияние на счёт (ScoreAffect) |
|---|---|---|
| NL | No Let (перезагрывание) | None |
| YL | Yes Let (лет) | None |
| ST | Stroke (очко) | WinPoint |
| CW | Conduct Warning | None |
| CS | Conduct Stroke | LosePoint |
| CG | Conduct Game | LoseGame |
| CM | Conduct Match | LoseMatch |
| PPW | Power Play Won | WinPoint |
| PPL | Power Play Lost | None |

### 7.2 Категории нарушений (`ConductType` enum)
| Категория | Описание |
|---|---|
| AbuseOfEquipment | Повреждение инвентаря |
| Obscenity | Нецензурная лексика |
| TimeWasting | Затягивание времени |
| Dissent | Несогласие |
| AbuseOfOfficial | Оскорбление судьи |
| PhysicalContact | Физический контакт |
| Unsporting | Неспортивное поведение |
| Coaching | Несанкционированный тренерский совет |

### 7.3 Broken Equipment — ОТСУТСТВУЕТ
| Код | Описание |
|---|---|
| BS | Broken String (порвана струна) |
| BR | Broken Racket (сломана ракетка) |
| BB | Broken Ball (испорчен мяч) |

---

## 8. TIMEOUT SYSTEM — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `recordTimeout(Player, boolean)` | Запись тайм-аута игрока | Средний |
| `m_player2TimeoutInfo` | Хранение информации о тайм-аутах | Средний |
| `getTimeoutInfo(Player)` | История тайм-аутов | Средний |
| `getLastTimeoutInfo(Player)` | Последний тайм-аут | Средний |
| `PlayerTimeout` dialog | Диалог вызова тайм-аута | Средний |
| Scoreline с `Misc.TO` | Запись TO в историю розыгрышей | Средний |

---

## 9. HANDICAP FORMAT — ОТСУТСТВУЕТ

| Формат | Описание |
|---|---|
| None | Без гандикапа |
| SameForAllGames | Одинаковый гандикап для всех геймов |
| DifferentForAllGames | Разный гандикап для каждого гейма |

---

## 10. PLAYER INFO — РАСШИРЕННЫЕ ПОЛЯ

### 10.1 Поля игрока, отсутствующие в веб-приложении
| Поле APK | JSON-ключ | Описание | Приоритет |
|---|---|---|---|
| `m_player2Club` | `clubs` | Клуб игрока | Средний |
| `m_player2Avatar` | `avatars` | URL аватара | Средний |
| `m_player2TimeoutInfo` | — | Информация о тайм-аутах | Средний |
| `seed` | `seed` | Посевной номер | Низкий |
| `abbreviation` | `abbreviation` | Аббревиатура имени | Низкий |
| `teamId` | `teamId` | ID команды | Средний |
| `teamPlayers` | `teamPlayers` | Список игроков команды | Средний |
| FirstName / LastName | `firstName`, `lastName` | Имя и фамилия отдельно | Низкий |

### 10.2 Настройки отображения игрока
| Настройка APK | Описание | Статус |
|---|---|---|
| `ShowCountryAs` | flag / name / code | ❌ ОТСУТСТВУЕТ |
| `ShowAvatarOn` | Где показывать аватар | ❌ ОТСУТСТВУЕТ |
| `ShowPlayerColorOn` | serve button / score button / player name | ❌ Частично |
| `hideAvatarForSameImage` | Скрыть одинаковые аватары | ❌ ОТСУТСТВУЕТ |
| `hideFlagForSameCountry` | Скрыть одинаковые флаги | ❌ ОТСУТСТВУЕТ |
| `NamePart` | Формат имени (first/last/full) | ❌ ОТСУТСТВУЕТ |

---

## 11. МЕТАДАННЫЕ МАТЧА — РАСШИРЕННЫЕ ПОЛЯ

| Поле APK | Переменная | Описание | Приоритет |
|---|---|---|---|
| `m_sCourt` | `court` | Название корта | ✅ Есть court_number |
| `m_sEventName` | `event.name` | Название турнира | Средний |
| `m_sEventDivision` | `event.division` | Дивизион | Средний |
| `m_sEventRound` | `event.round` | Раунд | ✅ Частично (round label) |
| `m_sEventLocation` | `event.location` | Место проведения | Средний |
| `m_sReferee` | `referee` | Судья | Средний |
| `m_sMarker` | `marker` | Маркер (записывающий) | Низкий |
| `m_sAssessor` | `assessor` | Ассессор | Низкий |
| `m_matchDate` | `when.date` | Дата матча | ✅ Есть created_at |
| `m_matchTime` | `when.time` | Время начала | ✅ Частично |
| `m_sSource` | `metadata.source` | Источник матча | Средний |
| `m_sSourceID` | `metadata.sourceID` | ID матча во внешней системе | Средний |
| `m_sPostURL` | — | URL для отправки результата | Средний |
| `m_shareUrl` | — | URL онлайн-табло | Средний |

---

## 12. LOCK STATES — ОТСУТСТВУЕТ

APK поддерживает 13 состояний блокировки матча (`LockState`):

| Состояние | Описание | Приоритет |
|---|---|---|
| Unlocked | Разблокирован | — |
| UnlockedManual | Ручная разблокировка | Средний |
| LockedManual | Ручная блокировка | Средний |
| LockedEndOfMatch | Блокировка по завершении матча | Средний |
| LockedIdleTime | Автоблокировка по таймауту неактивности | Средний |
| SharedEndedMatch | Совместный завершённый матч | Средний |
| LockedEndOfMatchRetired | Матч завершён из-за травмы | Средний |
| LockedEndOfMatchConduct | Матч завершён из-за нарушения | Средний |
| LockedEndOfMatchTimeBased | Матч завершён по времени | Средний |
| `numberOfMinutesAfterWhichToLockMatch` | Настройка таймаута автоблокировки | Средний |
| `kioskMode` | Киоск-режим (турнирная операция) | Средний |

---

## 13. END MATCH REASONS — ОТСУТСТВУЕТ

| Причина (`EndMatchManuallyBecause`) | Описание | Приоритет |
|---|---|---|
| RetiredBecauseOfInjury | Сход из-за травмы | Средний |
| ConductMatch | Дисквалификация за нарушение | Средний |
| TimeIsUp | Время матча истекло | Средний |

---

## 14. FEED / ИНТЕГРАЦИЯ С ТУРНИРАМИ

### 14.1 Трёхуровневая система фидов — ЧАСТИЧНО
| Уровень APK | Описание | Статус |
|---|---|---|
| 1. `feeds.php` — список типов фидов | Выбор провайдера (Rankedin, TS, SportyHQ, PSA) | ✅ Частично (только DY) |
| 2. `feeds.<type>.json` — список турниров | Выбор турнира из списка | ✅ Частично |
| 3. `{provider}/{id}/matches` — матчи | Выбор матча | ✅ Частично |
| 4. `{provider}/{id}/players` — игроки | Импорт игроков | ✅ Частично |

### 14.2 Поддерживаемые провайдеры
| Провайдер | Статус в веб-приложении |
|---|---|
| TournamentSoftware (Padel) | ❌ Нет прямого доступа (только через DY) |
| TournamentSoftware (Tennis) | ❌ Нет прямого доступа |
| TournamentSoftware Leagues | ❌ ОТСУТСТВУЕТ |
| Rankedin (Tennis/Padel) | ❌ Нет прямого доступа |
| **SportyHQ** (Tennis/Padel/Beach Tennis) | ❌ ОТСУТСТВУЕТ |
| **PSA World Tour** (Squash) | ❌ ОТСУТСТВУЕТ |
| Manual feeds | ❌ ОТСУТСТВУЕТ |

### 14.3 POST результатов — ОТСУТСТВУЕТ
| Функция APK | Описание | Приоритет |
|---|---|---|
| `ResultPoster` | Отправка JSON результата на URL | Высокий |
| HTTP Basic Auth | Username/password для POST | Высокий |
| Body Parameters | Альтернативный метод аутентификации | Средний |
| `PostDataPreference` | Auto / Manual / Ask перед отправкой | Средний |
| `SourceFeedbackState` | NotReachable / Rejected / AcceptedIntermediate / AcceptedFinal | Средний |
| Live Score auto-post | Авто-отправка при каждом изменении счёта | Средний |

### 14.4 Кэширование фидов
| Функция APK | Описание | Статус |
|---|---|---|
| `URLFeedTask` кэш | Сохранение ответов в `.txt` файлы | ❌ ОТСУТСТВУЕТ |
| `KeepInCacheFor_InProgress` | 30 мин для идущих матчей | ❌ ОТСУТСТВУЕТ |
| `KeepInCacheFor_NotStarted` | 60 мин для не начатых | ❌ ОТСУТСТВУЕТ |
| Pull-to-refresh | Принудительное обновление | ❌ ОТСУТСТВУЕТ |
| Валидация HTML | Проверка на битый ответ (`<html`, `<HTML`) | ❌ ОТСУТСТВУЕТ |
| Фильтрация по датам | `tournamentWasBusy_DaysBack`, `tournamentWillStartIn_DaysAhead`, `tournamentMaxDuration_InDays` | ❌ ОТСУТСТВУЕТ |
| Группировка по Country+Region | В списке турниров | ❌ ОТСУТСТВУЕТ |

### 14.5 Online Score Sheet
| Функция APK | Описание | Статус |
|---|---|---|
| `ScoreSheetOnline` activity | WebView для просмотра онлайн-табло | ❌ ОТСУТСТВУЕТ |
| `m_shareUrl` | Ссылка на онлайн-табло для скачивания | ❌ ОТСУТСТВУЕТ |
| `MatchModelPoster` | Авто-публикация на онлайн-табло | ❌ ОТСУТСТВУЕТ |

---

## 15. SOCIAL SHARING — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `ShareHelper` | Хаб шаринга | Средний |
| WhatsApp | Отправка результата в WhatsApp | Средний |
| Instagram | Отправка результата в Instagram | Средний |
| Facebook / Facebook Lite | Публикация на Facebook | Низкий |
| SMS | `smsResultToNr` — автоматическая отправка SMS | Средний |
| Email (краткий) | `ResultSender` — краткий результат | Средний |
| Email (полный) | `ResultMailer` — полный scoring sheet в HTML | Средний |
| `mailResultTo` | Авто-отправка на email | Низкий |
| `mailFullScoringSheet` | Флаг: отправлять ли полный протокол | Низкий |

---

## 16. SPEECH / TTS АНОНСЫ — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `Speak` класс | TTS движок для объявлений | Средний |
| Score announcements | "15-Love", "30-15", "Game Ball", "Match Ball" | Средний |
| Game/Match end announcements | "Game, Player A, 6-4" | Средний |
| Warmup/Timer announcements | "2 minutes remaining" | Средний |
| `SpeechType` enum | Handout, GameWon, GamesScore, GSMSetScore, ScoreServer, ScoreReceiver, Gameball, TimerRelated | Средний |
| Настройка голоса | pitch, rate, pause between parts | Низкий |
| `AnnouncementLanguage` | Выбор языка объявлений | Низкий |
| BT Audio keep-alive | Белый шум для удержания BT-соединения | Низкий |

---

## 17. DOUBLES SERVE SEQUENCES — РАСШИРЕНИЕ

APK поддерживает 5+ вариантов последовательности подач в парном разряде:

| Последовательность | Описание | Статус |
|---|---|---|
| A1B1A2B2 | Стандартная (теннис/падел) | ✅ Реализовано |
| A1B1A1B1 | Squash doubles | ❌ ОТСУТСТВУЕТ |
| A2B1B2... | Альтернативная | ❌ ОТСУТСТВУЕТ |
| A1B1B2... | Альтернативная | ❌ ОТСУТСТВУЕТ |
| A1A2B1B2 | Командная | ❌ ОТСУТСТВУЕТ |

### Выбор первого подающего / принимающего
| Диалог APK | Описание | Статус |
|---|---|---|
| `DoublesFirstServer` | Выбор первого подающего в паре | ❌ ОТСУТСТВУЕТ |
| `DoublesFirstReceiver` | Выбор первого принимающего | ❌ ОТСУТСТВУЕТ |
| `DoublesServerReceiver` | Комбинированный выбор | ❌ ОТСУТСТВУЕТ |
| I/O индикатор | Inside/Outside для doubles | ❌ ОТСУТСТВУЕТ |
| Receiver marking | Визуальная отметка принимающего | ❌ ОТСУТСТВУЕТ |

---

## 18. MQTT СИНХРОНИЗАЦИЯ — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `MQTTHandler` (511 строк) | Полный MQTT-клиент | Низкий |
| Master/Slave роли | Синхронизация устройств | Низкий |
| Device Discovery | Обнаружение устройств через MQTT | Низкий |
| Joiner/Leaver протокол | `join`, `thanksForJoining`, `leave` | Низкий |
| Battery/WiFi sharing | Обмен статусом батареи и сети | Низкий |
| Configurable broker URL | Настройка MQTT-брокера | Низкий |
| QoS 0, MemoryPersistence | Настройки качества обслуживания | Низкий |
| Device info каждые N сек | Периодическая публикация статуса | Низкий |

> **Примечание**: Supabase Realtime покрывает базовую потребность в real-time синхронизации.

---

## 19. BLUETOOTH — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| Classic Bluetooth | Master/Equal/Slave роли | Низкий |
| BLE (Low Energy) | Интеграция с периферийными устройствами | Низкий |
| Media button scoring | Управление счётом через кнопки BT-гарнитуры | Низкий |
| Auto-reconnect | Автоматическое переподключение | Низкий |
| Battery status чтение | Чтение заряда батареи BT-устройства | Низкий |
| Confirmation mode | Подтверждение очка на BT-устройстве | Низкий |
| Keep serve side mirrored | Синхронизация стороны подачи | Низкий |

> **Примечание**: Веб-приложение физически не может использовать Bluetooth API браузера.

---

## 20. CHROMECAST — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| Dual API (старый + новый Cast Framework) | Поддержка обоих API | Низкий |
| 30+ типов сообщений | Полная синхронизация табло | Низкий |
| Sponsor/Logo URLs | Кастомные логотипы спонсоров | Низкий |
| Secondary Display (HDMI) | `PresentationScreen` для проводного вывода | Низкий |
| EndOfGameView | Экран завершения гейма на TV | Низкий |
| FullScreenTimer | Полноэкранный таймер на TV | Низкий |
| Remote Config (CastConfig.json) | Динамические App ID | Низкий |
| Per-brand App ID | Разные приложения для Squore/TennisPadel | Низкий |

> **Примечание**: vMix + Fullscreen Scoreboard покрывают эту потребность в веб-приложении.

---

## 21. WEAR OS — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `WearableHelper` | Связь с Wear OS часами | Низкий |
| Hardware button scoring | Набор очков кнопками часов | Низкий |
| Rotary scoring | Набор очков безелем часов | Низкий |
| `DataLayerListenerService` | Фоновый слушатель данных | Низкий |
| Wear Role sync | Синхронизация ролей между устройствами | Низкий |

---

## 22. KIOSK / DEMO MODE — ОТСУТСТВУЕТ

| Функция APK | Описание | Приоритет |
|---|---|---|
| Kiosk Mode | Режим киоска для турниров | Средний |
| `DemoThread` | Автоматическая демонстрация подсчёта | Низкий |
| `FullDemoThread` | Полный демо-прогон | Низкий |
| `PromoThread` | Промо-ролик | Низкий |
| Remote Settings URL | Динамическая удалённая конфигурация | Средний |
| Auto-activate settings | Автоматическая активация настроек | Низкий |

---

## 23. АРХИВАЦИЯ И ИСТОРИЯ

| Функция APK | Описание | Статус | Приоритет |
|---|---|---|---|
| `ArchiveTabbed` | Вкладочный браузер архива | ❌ ОТСУТСТВУЕТ | Средний |
| `PreviousMatchSelector` | Просмотр прошлых матчей | ✅ Есть `/history` | — |
| `ReadStoredMatches` | Чтение файлов матчей | ✅ Через Supabase | — |
| `RecentMatchesMultiSelect` | Мультивыбор матчей | ❌ ОТСУТСТВУЕТ | Низкий |
| `GroupMatchesBy` | Группировка матчей | ❌ ОТСУТСТВУЕТ | Низкий |
| Файловая персистенция | `LAST.Sport.sb` — последний матч | ✅ Через localStorage | — |
| `PersistHelper` | Сохранение/загрузка матчей | ✅ Через Supabase | — |

---

## 24. DIALOG SYSTEM — UI КОМПОНЕНТЫ

53+ диалога в APK. Ключевые отсутствующие:

| Диалог APK | Описание | Приоритет |
|---|---|---|
| `AdjustScore` | Ручная корректировка счёта | Средний |
| `Appeal` | Запись апелляции (Let/No Let/Stroke) | Средний |
| `BrokenWhat` | Выбор сломанного инвентаря | Низкий |
| `Conduct` | Запись нарушения с выбором типа | Средний |
| `EditMatchWizard` | Пошаговый мастер настройки матча | Низкий |
| `EditMatchDate` | Изменение даты/времени матча | Средний |
| `EndGameChoice` | Выбор способа завершения гейма | Низкий |
| `EndMatchChoice` | Выбор способа завершения матча (Retired/Conduct/Time) | Средний |
| `Handicap` | Установка гандикапа | Средний |
| `InjuryType` | Выбор типа травмы (4 варианта) | Средний |
| `MatchInfo` | Ввод метаданных матча | Средний |
| `PlayerTimeout` | Вызов тайм-аута | Средний |
| `PowerPlayFor` | Активация Power Play | Средний |
| `RallyEndStats` | Запись статистики розыгрыша | Средний |
| `ServerToss` / `SideToss` | Жеребьёвка (подача/сторона) | Средний |
| `UsernamePassword` | Ввод учётных данных для POST | Средний |
| `ColorPicker` | Выбор цвета игрока | ✅ Частично |
| `PostMatchResult` | Отправка результата на сервер | Средний |
| `LockedMatch` | Информация о блокировке матча | Средний |

---

## 25. ИНТЕГРАЦИЯ С ВНЕШНИМИ ПРИЛОЖЕНИЯМИ

| Функция APK | Описание | Приоритет |
|---|---|---|
| `Glue` класс | Intent API для запуска из других приложений с преднастройкой | Средний |
| Tournament mode launch | Внешнее приложение может запустить матч с заданными параметрами | Средний |
| Media Session | Управление через BT media controls (play/pause/volume) | Низкий |
| Volume keys scoring | Набор очков кнопками громкости | Низкий |

---

## 26. СЛОЖНАЯ ЛОГИКА UNDO

| Функция APK | Описание | Статус |
|---|---|---|
| `undoLast()` — базовый | Отмена последнего очка | ✅ Реализовано |
| `undoLastForScorer()` | Undo для скорера (подтверждение) | ❌ ОТСУТСТВУЕТ |
| `undoBackOneGame()` | Отмена целого гейма | ❌ ОТСУТСТВУЕТ |
| GSM: undo через сет | При undo на 0-0 нового сета — возврат к предыдущему сету | ❌ ОТСУТСТВУЕТ |
| `determineServerAndSideForUndoFromPreviousScoreLine` | Восстановление подачи/стороны при undo | ❌ Частично |
| `m_prevScoreline2DoublesServe` | История doubles serve для undo | ❌ ОТСУТСТВУЕТ |
| `m_prevScoreline2ServingTeam` | История подающей команды для undo | ❌ ОТСУТСТВУЕТ |

---

## 27. VISUAL UI FEATURES

| Функция APK | Описание | Статус | Приоритет |
|---|---|---|---|
| Game Graph | Визуальный график хода счёта в гейме | ❌ ОТСУТСТВУЕТ | Средний |
| Match History View | Полный просмотр истории розыгрышей | ❌ ОТСУТСТВУЕТ | Средний |
| Match Calls View | Просмотр судейских решений | ❌ ОТСУТСТВУЕТ | Средний |
| FocusEffect | BlinkByInverting / SetTransparency для фокуса | ❌ ОТСУТСТВУЕТ | Низкий |
| Score change indicator | Подсветка изменения счёта | ❌ ОТСУТСТВУЕТ | Средний |
| `showScoringHistoryInMainScreenOn` | История розыгрышей на главном экране | ❌ ОТСУТСТВУЕТ | Средний |
| `indicateGameBall` | Визуальный индикатор Game Ball | ✅ Реализовано | — |
| `indicateGoldenPoint` | Индикатор Golden Point | ✅ Реализовано | — |
| Game Scores Appearance | Настройка отображения счёта геймов | ✅ Частично | — |
| Chronometer display | Отображение хронометра на табло | ❌ ОТСУТСТВУЕТ | Средний |
| Logo/Sponsor на табло | Кастомные логотипы | ❌ ОТСУТСТВУЕТ | Низкий |

---

## 28. BRAND / КОНФИГУРАЦИЯ

| Функция APK | Описание | Приоритет |
|---|---|---|
| 2 бренда: Squore / TennisPadel | Переключение бренда в рантайме | Низкий |
| Разные Base URL для брендов | `squore.double-yellow.be` vs `tennispadel.double-yellow.be` | Низкий |
| Разные Cast App ID | Разные приложения ChromeCast | Низкий |
| Спорт-специфичные возможности | Timeout, ChooseSide, DoubleServeSequence и т.д. | Средний |

---

## СВОДНАЯ ТАБЛИЦА: Приоритеты внедрения

### КРИТИЧЕСКИЙ приоритет
1. **Timing/Хронометраж** — начало/конец геймов, время между очками, длительность матча
2. **POST результатов** — отправка результатов во внешние API
3. **Таймеры матча** — warmup, паузы, injury, timeout (9 типов)

### ВЫСОКИЙ приоритет
4. **Squash** — полная модель (English/PAR, handout, conduct, appeal)
5. **Table Tennis** — модель (NrOfServes, Expedite, тай-брейк при 10-10)
6. **Badminton** — модель (до 21/30, новые правила подачи)
7. **Rally-End Statistics** — запись и отображение Winner/Error по категориям

### СРЕДНИЙ приоритет
8. **Racquetball** — модель подсчёта
9. **Racketlon** — мульти-спорт формат
10. **Conduct система** — нарушения, предупреждения, карточки (8 категорий)
11. **Broken Equipment** — порвана струна, сломана ракетка, испорчен мяч
12. **Timeout System** — тайм-ауты игроков с трекингом
13. **Handicap** — система гандикапа (3 формата)
14. **Power Play** — активируемые PP для следующего розыгрыша
15. **New Balls tracking** — 4 режима расписания замены мячей
16. **Lock States** — 13 состояний блокировки матча
17. **End Match Reasons** — Retired/Conduct/TimeIsUp
18. **Event/Match metadata** — tournament, division, round, location, referee, marker, assessor
19. **Extended Player Info** — club, avatar, seed, abbreviation, teamId
20. **Doubles Serve Sequences** — 5 вариантов (A1B1A2B2, A1B1A1B1, ...)
21. **First Server/Receiver dialogs** — выбор подающего/принимающего в паре
22. **TieBreakFormat расширения** — SelectOneOrTwo, SelectOneTwoOrThree, SelectOneOrThree
23. **Score Notation** — 4-символьная история каждого розыгрыша
24. **Social Sharing** — WhatsApp, Instagram, Facebook, SMS, Email
25. **TTS Announcements** — голосовые объявления на разных языках
26. **Game Graph View** — визуальный график хода счёта
27. **Adjust Score** — ручная корректировка счёта
28. **Server/Side Toss** — жеребьёвка подачи и стороны
29. **Glue API** — интеграция с внешними приложениями
30. **SportyHQ / PSA интеграция** — дополнительные источники фидов
31. **Online Score Sheet** — WebView для просмотра табло
32. **Live Score auto-post** — авто-отправка при каждом изменении
33. **Feed caching** — кэширование с настраиваемым TTL
34. **Undo на весь гейм** — `undoBackOneGame()`

### НИЗКИЙ приоритет (специфичные/нишевые)
35. MQTT протокол (Supabase Realtime покрывает)
36. Bluetooth Classic + BLE (недоступно в браузере)
37. ChromeCast (vMix покрывает)
38. Wear OS (недоступно в браузере)
39. Kiosk Mode
40. Demo Mode
41. Remote Configuration
42. Brand toggle
43. BT Audio keep-alive
44. Full country/region system (ISO/FIFA/IOC)
45. Volume/Back key customization
46. Toweling Down timer
47. Player name format (first/last/full)
46. Sponsor/Logo на табло
47. PlayAllGames (доигрывать все геймы после определения победителя)
