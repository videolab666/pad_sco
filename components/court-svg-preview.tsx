"use client"

import { useContext, useState, useEffect } from "react"
import { LanguageContext } from "@/contexts/language-context"
import { translations } from "@/lib/translations"

function CourtSVG({
  teamAPlayer1 = "Player 1",
  teamAPlayer2 = "Player 2",
  teamBPlayer1 = "Player 3",
  teamBPlayer2 = "Player 4",
  swapTeamAPlayers,
  swapTeamBPlayers,
  swapCourtSides,
  servingTeam = "teamA",
  servingPlayerIndex = 0,
  courtSides = { teamA: "left", teamB: "right" },
  match,
}) {
  const { language } = useContext(LanguageContext)

  // Определяем, какая четверть корта должна быть подсвечена
  const isServing = (team, playerIndex) => {
    return team === servingTeam && playerIndex === servingPlayerIndex
  }

  // Определяем сторону подачи (R - правая, L - левая)
  const getServeSide = () => {
    // Если матч не инициализирован, вернуть правую сторону по умолчанию
    if (!match) return "R"

    // Получаем текущий гейм, если он есть
    const currentGame = match?.score?.currentSet?.currentGame
    if (!currentGame) return "R"

    // Считаем общее количество очков в текущем гейме
    const totalPoints =
      (currentGame.teamA === "Ad"
        ? 4
        : typeof currentGame.teamA === "number"
          ? currentGame.teamA === 0
            ? 0
            : currentGame.teamA === 15
              ? 1
              : currentGame.teamA === 30
                ? 2
                : 3
          : 0) +
      (currentGame.teamB === "Ad"
        ? 4
        : typeof currentGame.teamB === "number"
          ? currentGame.teamB === 0
            ? 0
            : currentGame.teamB === 15
              ? 1
              : currentGame.teamB === 30
                ? 2
                : 3
          : 0)

    // В тай-брейке логика немного другая
    if (match?.score?.currentSet?.isTiebreak) {
      // В тай-брейке первая подача справа, затем чередуется каждые 2 очка
      // Но первая смена происходит после 1 очка
      if (totalPoints === 0) return "R"

      // После первого очка и далее
      // Нечетное количество очков - левая сторона, четное - правая
      return totalPoints % 2 === 1 ? "L" : "R"
    }

    // В обычном гейме: четное количество очков - правая сторона, нечетное - левая
    return totalPoints % 2 === 0 ? "R" : "L"
  }

  // Определяем позиции игроков на основе сторон корта
  const getPlayerPositions = () => {
    // По умолчанию команда A слева, команда B справа
    let positions = {
      topLeft: { team: "teamA", playerIndex: 0 },
      bottomLeft: { team: "teamA", playerIndex: 1 },
      topRight: { team: "teamB", playerIndex: 0 },
      bottomRight: { team: "teamB", playerIndex: 1 },
    }

    // Если стороны поменяны, меняем позиции команд
    if (courtSides.teamA === "right") {
      positions = {
        topLeft: { team: "teamB", playerIndex: 0 },
        bottomLeft: { team: "teamB", playerIndex: 1 },
        topRight: { team: "teamA", playerIndex: 0 },
        bottomRight: { team: "teamA", playerIndex: 1 },
      }
    }

    return positions
  }

  const positions = getPlayerPositions()

  // Получаем имена игроков для каждой позиции
  const getPlayerName = (position) => {
    const { team, playerIndex } = position
    if (team === "teamA") {
      return playerIndex === 0 ? teamAPlayer1 : teamAPlayer2
    } else {
      return playerIndex === 0 ? teamBPlayer1 : teamBPlayer2
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 2020 1093"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="Group 4">
        <g id="Group 3">
          <g id="On Button" filter="url(#filter0_dddn_2106_354)">
            <g id="On Button_2" clipPath="url(#clip0_2106_354)">
              <rect id="On Button BG" width="2009" height="1004" rx="14" fill="url(#paint0_radial_2106_354)" />
            </g>
          </g>

          {/* Четверти корта с подсветкой подающего */}
          <rect
            x="0"
            y="0"
            width="978"
            height="492"
            fill={
              isServing(positions.topLeft.team, positions.topLeft.playerIndex)
                ? "rgba(255, 100, 100, 0.3)"
                : "transparent"
            }
          />
          <rect
            x="978"
            y="0"
            width="1031"
            height="492"
            fill={
              isServing(positions.topRight.team, positions.topRight.playerIndex)
                ? "rgba(255, 100, 100, 0.3)"
                : "transparent"
            }
          />
          <rect
            x="0"
            y="502"
            width="978"
            height="502"
            fill={
              isServing(positions.bottomLeft.team, positions.bottomLeft.playerIndex)
                ? "rgba(255, 100, 100, 0.3)"
                : "transparent"
            }
          />
          <rect
            x="978"
            y="502"
            width="1031"
            height="502"
            fill={
              isServing(positions.bottomRight.team, positions.bottomRight.playerIndex)
                ? "rgba(255, 100, 100, 0.3)"
                : "transparent"
            }
          />

          <g id="Volume Slider Track Base">
            <mask id="path-2-inside-1_2106_354" fill="white">
              <rect y="492" width="2009" height="10" rx="1.5" />
            </mask>
            <rect
              y="492"
              width="2009"
              height="10"
              rx="1.5"
              fill="#A2A2A2"
              stroke="#989898"
              strokeWidth="8"
              mask="url(#path-2-inside-1_2106_354)"
            />
          </g>
          <g id="Volume Slider Track Base_2" filter="url(#filter1_dd_2106_354)">
            <mask id="path-3-inside-2_2106_354" fill="white">
              <rect x="978" width="1004" height="8.99996" rx="1.5" transform="rotate(90 978 0)" />
            </mask>
            <rect x="978" width="1004" height="8.99996" rx="1.5" transform="rotate(90 978 0)" fill="white" />
            <rect
              x="978"
              width="1004"
              height="8.99996"
              rx="1.5"
              transform="rotate(90 978 0)"
              stroke="#989898"
              strokeWidth="4"
              mask="url(#path-3-inside-2_2106_354)"
            />
          </g>
          <rect
            id="Volume Slider Track Base_3"
            opacity="0.33"
            x="335"
            y="1"
            width="1002"
            height="3.99996"
            transform="rotate(90 335 1)"
            fill="white"
            stroke="#989898"
            strokeWidth="2"
          />
          <rect
            id="Volume Slider Track Base_4"
            opacity="0.33"
            x="1671"
            y="1"
            width="1002"
            height="3.99996"
            transform="rotate(90 1671 1)"
            fill="white"
            stroke="#989898"
            strokeWidth="2"
          />

          {/* Кнопка смены игроков команды A */}
          <g id="Buttons/Generic Button" filter="url(#filter2_d_2106_354)">
            <g id="Generic Button">
              <g id="On Button_3" clipPath="url(#clip1_2106_354)">
                <rect
                  id="On Button BG_2"
                  x="252"
                  y="431"
                  width="155"
                  height="132"
                  rx="14"
                  fill="url(#paint1_linear_2106_354)"
                />
                <g
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    // Определяем, какая команда находится слева, и меняем её игроков
                    if (courtSides.teamA === "left") {
                      swapTeamAPlayers()
                    } else {
                      swapTeamBPlayers()
                    }
                  }}
                  tabIndex={0} // для фокуса с клавиатуры
                  aria-label="Swap players team A"
                >
                  <rect
                    x={252}
                    y={431}
                    width={155}
                    height={132}
                    rx={14}
                    fill="transparent"
                    stroke="#0022FF"
                    strokeWidth={3}
                  />
                  <svg
                    x={252 + 37.5}
                    y={431 + 26}
                    width={80}
                    height={80}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0022FF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m18 8-6-6-6 6" />
                    <path d="m18 16-6 6-6-6" />
                    <path d="M12 2v20" />
                  </svg>
                </g>
              </g>
            </g>
          </g>

          {/* Кнопка смены игроков команды B */}
          <g id="Buttons/Generic Button_2" filter="url(#filter3_d_2106_354)">
            <g id="Generic Button_2">
              <g id="On Button_4" clipPath="url(#clip2_2106_354)">
                <rect
                  id="On Button BG_3"
                  x="1588"
                  y="431"
                  width="155"
                  height="132"
                  rx="14"
                  fill="url(#paint2_linear_2106_354)"
                />
                <g
  style={{ cursor: "pointer" }}
  onClick={() => {
    // Определяем, какая команда находится справа, и меняем её игроков
    if (courtSides.teamA === "right") {
      swapTeamAPlayers()
    } else {
      swapTeamBPlayers()
    }
  }}
  tabIndex={0} // для фокуса с клавиатуры
  aria-label="Swap players team B"
>
  <rect
    x={1588}
    y={431}
    width={155}
    height={132}
    rx={14}
    fill="transparent"
    stroke="#0022FF"
    strokeWidth={3}
  />
  <svg
    x={1588 + 37.5}
    y={431 + 26}
    width={80}
    height={80}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0022FF"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m18 8-6-6-6 6" />
    <path d="m18 16-6 6-6-6" />
    <path d="M12 2v20" />
  </svg>
</g>
              </g>
            </g>
          </g>

          {/* Кнопка смены сторон корта - чистая SVG версия */}
          <g id="Buttons/Generic Button_3">
            <g id="Generic Button_3">
              <g id="On Button_5">
                <rect
                  id="On Button BG_4"
                  x="907"
                  y="797"
                  width="600"
                  height="132"
                  rx="14"
                  transform="rotate(-90 907 797)"
                  fill="url(#paint3_linear_2106_354)"
                />
                <g
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    // Call the local function to update the visualization
                    const newSides = swapCourtSides()

                    // Dispatch a custom event to notify other components
                    const event = new CustomEvent("courtSidesSwapped", {
                      detail: {
                        newSides: newSides,
                      },
                    })
                    window.dispatchEvent(event)
                  }}
                  tabIndex={0}
                  aria-label="Swap court sides"
                >
                  <rect
                    x={910}  // Сдвинуто влево на 3px
                    y={197}  // Сдвинуто вверх на 3px
                    width={132}
                    height={600}
                    fill="transparent"
                    stroke="#FAFFBA"
                    strokeWidth={3}
                    rx={14}
                  />
                  <svg
                    x={910 + (132 - 120) / 2}  // Сдвинуто вместе с прямоугольником
                    y={197 + (600 - 120) / 2}  // Сдвинуто вместе с прямоугольником
                    width={120}
                    height={120}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FAFFBA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3L4 7l4 4" />
                    <path d="M4 7h16" />
                    <path d="m16 21 4-4-4-4" />
                    <path d="M20 17H4" />
                  </svg>
                </g>
              </g>
            </g>
          </g>

          {/* Игрок в верхнем левом углу */}
          <foreignObject x="50" y="50" width="978" height="300">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: "100%",
                height: "100%",
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: "83px", // Уменьшено с 108px в 1.3 раза
                fontWeight: "bold",
                userSelect: "text",
                lineHeight: "1.2",
                display: "flex",
                flexDirection: "column",
                wordWrap: "break-word",
                whiteSpace: "normal",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {isServing(positions.topLeft.team, positions.topLeft.playerIndex) && (
                  <span
                    style={{
                      backgroundColor: "#a7e32d",
                      color: "#2d5016",
                      borderRadius: "50%",
                      width: "90px",
                      height: "90px",
                      minWidth: "90px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "75px", // Увеличено с 50px в 1.5 раза
                      fontWeight: "bold",
                      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                      border: "3px solid white",
                    }}
                  >
                    {getServeSide()}
                  </span>
                )}
                <div className="break-words max-w-[80%] leading-tight">{getPlayerName(positions.topLeft)}</div>
              </div>
            </div>
          </foreignObject>

          {/* Игрок в нижнем левом углу */}
          <foreignObject x="50" y="600" width="978" height="300">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: "100%",
                height: "100%",
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: "83px", // Уменьшено с 108px в 1.3 раза
                fontWeight: "bold",
                userSelect: "text",
                lineHeight: "1.2",
                display: "flex",
                flexDirection: "column-reverse",
                wordWrap: "break-word",
                whiteSpace: "normal",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {isServing(positions.bottomLeft.team, positions.bottomLeft.playerIndex) && (
                  <span
                    style={{
                      backgroundColor: "#a7e32d",
                      color: "#2d5016",
                      borderRadius: "50%",
                      width: "90px",
                      height: "90px",
                      minWidth: "90px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "75px", // Увеличено с 50px в 1.5 раза
                      fontWeight: "bold",
                      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                      border: "3px solid white",
                    }}
                  >
                    {getServeSide()}
                  </span>
                )}
                <div className="break-words max-w-[80%] leading-tight">{getPlayerName(positions.bottomLeft)}</div>
              </div>
            </div>
          </foreignObject>

          {/* Игрок в верхнем правом углу */}
          <foreignObject x="992" y="50" width="978" height="300">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: "100%",
                height: "100%",
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: "83px", // Уменьшено с 108px в 1.3 раза
                fontWeight: "bold",
                userSelect: "text",
                textAlign: "right",
                lineHeight: "1.2",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                wordWrap: "break-word",
                whiteSpace: "normal",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px", marginRight: "30px" }}>
                <div className="break-words max-w-[95%] leading-tight">{getPlayerName(positions.topRight)}</div>
                {isServing(positions.topRight.team, positions.topRight.playerIndex) && (
                  <span
                    style={{
                      backgroundColor: "#a7e32d",
                      color: "#2d5016",
                      borderRadius: "50%",
                      width: "90px",
                      height: "90px",
                      minWidth: "90px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "75px", // Увеличено с 50px в 1.5 раза
                      fontWeight: "bold",
                      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                      border: "3px solid white",
                    }}
                  >
                    {getServeSide()}
                  </span>
                )}
              </div>
            </div>
          </foreignObject>

          {/* Игрок в нижнем правом углу */}
          <foreignObject x="992" y="600" width="978" height="300">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: "100%",
                height: "100%",
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: "83px", // Уменьшено с 108px в 1.3 раза
                fontWeight: "bold",
                userSelect: "text",
                textAlign: "right",
                lineHeight: "1.2",
                display: "flex",
                flexDirection: "column-reverse",
                alignItems: "flex-end",
                wordWrap: "break-word",
                whiteSpace: "normal",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px", marginRight: "30px" }}>
                <div className="break-words max-w-[95%] leading-tight">{getPlayerName(positions.bottomRight)}</div>
                {isServing(positions.bottomRight.team, positions.bottomRight.playerIndex) && (
                  <span
                    style={{
                      backgroundColor: "#a7e32d",
                      color: "#2d5016",
                      borderRadius: "50%",
                      width: "90px",
                      height: "90px",
                      minWidth: "90px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "75px", // Увеличено с 50px в 1.5 раза
                      fontWeight: "bold",
                      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                      border: "3px solid white",
                    }}
                  >
                    {getServeSide()}
                  </span>
                )}
              </div>
            </div>
          </foreignObject>

          <g id="Group 2" filter="url(#filter5_d_2106_354)">
            <circle
              id="Profile Button BG"
              cx="71.5"
              cy="71.5"
              r="71.5"
              transform="matrix(-1 8.74228e-08 -2.74103e-08 1 1044 950)"
              fill="url(#paint4_linear_2106_354)"
            />
            <path
              id="Path"
              d="M972.498 1020.42C980.068 1020.42 986.205 1014.14 986.205 1006.41C986.205 998.667 980.068 992.394 972.498 992.394C964.928 992.394 958.792 998.667 958.792 1006.41C958.792 1014.14 964.928 1020.42 972.498 1020.42Z"
              fill="white"
            />
            <path
              id="Path_2"
              d="M972.499 1076.75C985.063 1076.75 995.249 1066.56 995.249 1054C995.249 1041.44 985.063 1031.25 972.499 1031.25C959.934 1031.25 949.749 1041.44 949.749 1054C949.749 1066.56 959.934 1076.75 972.499 1076.75Z"
              fill="white"
            />
            <path
              id="Path_3"
              d="M987.339 1031.15L987.626 1031.32C996.033 1036.45 1001.73 1045.74 1002.02 1056.41L1002.03 1057.25L1008.25 1057.25C1008.25 1044.52 1001.88 1033.31 992.226 1026.77C990.78 1028.43 989.139 1029.9 987.339 1031.15Z"
              fill="white"
            />
            <path
              id="Path_4"
              d="M936.759 1056.32L936.748 1057.25L942.965 1057.25C942.965 1046.11 948.87 1036.38 957.656 1031.14C955.858 1029.9 954.217 1028.43 952.772 1026.77C943.628 1032.96 937.433 1043.34 936.801 1055.24L936.759 1056.32Z"
              fill="white"
            />
          </g>
        </g>
      </g>
      <defs>
        <filter
          id="filter0_dddn_2106_354"
          x="-11.1"
          y="-8.1"
          width="2051.2"
          height="1046.2"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="8" dy="13" />
          <feGaussianBlur stdDeviation="8.15" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.463622 0 0 0 0 0.842949 0 0 0 0.33 0" />
          <feBlend mode="normal" in2="effect1_dropShadow_2106_354" result="effect2_dropShadow_2106_354" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="10" dy="13" />
          <feGaussianBlur stdDeviation="10.55" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="effect2_dropShadow_2106_354" result="effect3_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        </filter>
        <filter
          id="filter1_dd_2106_354"
          x="942.4"
          y="-49.6"
          width="108.2"
          height="1103.2"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="8" />
          <feGaussianBlur stdDeviation="6.25" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="23" />
          <feGaussianBlur stdDeviation="24.8" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feBlend mode="normal" in2="effect1_dropShadow_2106_354" result="effect2_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_2106_354" result="shape" />
        </filter>
        <filter
          id="filter2_d_2106_354"
          x="248.8"
          y="424.8"
          width="185.4"
          height="162.4"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="12" dy="9" />
          <feGaussianBlur stdDeviation="7.6" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2106_354" result="shape" />
        </filter>
        <filter
          id="filter3_d_2106_354"
          x="1584.8"
          y="424.8"
          width="185.4"
          height="162.4"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="12" dy="9" />
          <feGaussianBlur stdDeviation="7.6" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2106_354" result="shape" />
        </filter>
        <filter
          id="filter4_d_2106_354"
          x="903.8"
          y="190.8"
          width="162.4"
          height="630.4"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="12" dy="9" />
          <feGaussianBlur stdDeviation="7.6" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2106_354" result="shape" />
        </filter>
        <filter
          id="filter5_d_2106_354"
          x="866.899"
          y="922.9"
          width="211.2"
          height="211.2"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="7" />
          <feGaussianBlur stdDeviation="17.05" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.57 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2106_354" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2106_354" result="shape" />
        </filter>
        <radialGradient
          id="paint0_radial_2106_354"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(47.5219 1002.01) rotate(26.5536) scale(1094.17 875.073)"
        >
          <stop stopColor="#75D0EF" />
          <stop offset="1" stopColor="#006FEE" />
        </radialGradient>
        <linearGradient
          id="paint1_linear_2106_354"
          x1="180.153"
          y1="498.431"
          x2="307.128"
          y2="647.53"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#42BB3C" />
          <stop offset="1" stopColor="#E7FF61" />
        </linearGradient>
        <linearGradient
          id="paint2_linear_2106_354"
          x1="1516.15"
          y1="498.431"
          x2="1643.13"
          y2="647.53"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#42BB3C" />
          <stop offset="1" stopColor="#E7FF61" />
        </linearGradient>
        <linearGradient
          id="paint3_linear_2106_354"
          x1="628.883"
          y1="864.431"
          x2="682.862"
          y2="1109.79"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#BB773C" />
          <stop offset="1" stopColor="#FF6161" />
        </linearGradient>
        <linearGradient
          id="paint4_linear_2106_354"
          x1="76.0929"
          y1="212.204"
          x2="214.5"
          y2="69.2036"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6B42E3" />
          <stop offset="1" stopColor="#4B97E4" />
        </linearGradient>
        <clipPath id="clip0_2106_354">
          <rect width="2009" height="1004" fill="white" />
        </clipPath>
        <clipPath id="clip1_2106_354">
          <rect width="155" height="132" fill="white" transform="translate(252 431)" />
        </clipPath>
        <clipPath id="clip2_2106_354">
          <rect width="155" height="132" fill="white" transform="translate(1588 431)" />
        </clipPath>
        <clipPath id="clip3_2106_354">
          <rect width="600" height="132" fill="white" transform="translate(907 797) rotate(-90)" />
        </clipPath>
      </defs>
    </svg>
  )
}

export default function CourtPreview({ match }) {
  const { language } = useContext(LanguageContext)
  const t = translations[language]
  const [swappedTeamA, setSwappedTeamA] = useState(false)
  const [swappedTeamB, setSwappedTeamB] = useState(false)
  const [localCourtSides, setLocalCourtSides] = useState({ teamA: "left", teamB: "right" })

  // Синхронизация с данными матча
  useEffect(() => {
    if (match) {
      // Сбрасываем состояние свопа при изменении матча
      setSwappedTeamA(false)
      setSwappedTeamB(false)
      // Синхронизируем стороны корта с матчем
      if (match.courtSides) {
        setLocalCourtSides(match.courtSides)
      }
    }
  }, [match])

  // Получаем имена игроков из объекта match
  const getPlayerName = (team, index) => {
    try {
      return match?.[team]?.players[index]?.name || `${t.player} ${index + 1}`
    } catch (e) {
      return `${t.player} ${index + 1}`
    }
  }

  // Получаем имена игроков команды A с учетом свопа
  const teamAPlayer1 = swappedTeamA ? getPlayerName("teamA", 1) : getPlayerName("teamA", 0)
  const teamAPlayer2 = swappedTeamA ? getPlayerName("teamA", 0) : getPlayerName("teamA", 1)

  // Получаем имена игроков команды B с учетом свопа
  const teamBPlayer1 = swappedTeamB ? getPlayerName("teamB", 1) : getPlayerName("teamB", 0)
  const teamBPlayer2 = swappedTeamB ? getPlayerName("teamB", 0) : getPlayerName("teamB", 1)

  // Функция для смены позиций игроков команды А
  const swapTeamAPlayers = () => {
    const newValue = !swappedTeamA
    setSwappedTeamA(newValue)

    // Генерируем пользовательское событие для синхронизации с другими компонентами
    const event = new CustomEvent("teamPlayersSwapped", {
      detail: { team: "teamA", swapped: newValue },
    })
    window.dispatchEvent(event)
  }

  // Функция для смены позиций игроков команды B
  const swapTeamBPlayers = () => {
    const newValue = !swappedTeamB
    setSwappedTeamB(newValue)

    // Генерируем пользовательское событие для синхронизации с другими компонентами
    const event = new CustomEvent("teamPlayersSwapped", {
      detail: { team: "teamB", swapped: newValue },
    })
    window.dispatchEvent(event)
  }

  // Функция для смены сторон корта
  const swapCourtSides = () => {
    const newSides = {
      teamA: localCourtSides.teamA === "left" ? "right" : "left",
      teamB: localCourtSides.teamB === "left" ? "right" : "left",
    }
    setLocalCourtSides(newSides)
    return newSides
  }

  // Получаем информацию о текущем подающем
  const servingTeam = match?.currentServer?.team || "teamA"
  const servingPlayerIndex = match?.currentServer?.playerIndex || 0

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full aspect-[2020/1093] max-h-[400px] border border-gray-300 rounded-lg">
        <CourtSVG
          teamAPlayer1={teamAPlayer1}
          teamAPlayer2={teamAPlayer2}
          teamBPlayer1={teamBPlayer1}
          teamBPlayer2={teamBPlayer2}
          swapTeamAPlayers={swapTeamAPlayers}
          swapTeamBPlayers={swapTeamBPlayers}
          swapCourtSides={swapCourtSides}
          servingTeam={servingTeam}
          servingPlayerIndex={servingPlayerIndex}
          courtSides={localCourtSides}
          match={match}
        />
      </div>
    </div>
  )
}
