"use client"

import React from "react";
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchList } from "@/components/match-list"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"
import { Bug, Users, History } from "lucide-react"
import { CourtsList } from "@/components/courts-list"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/contexts/language-context"

const PASSWORD = "111";
const AUTH_KEY = "main_page_auth";
const AUTH_DATE_KEY = "main_page_auth_date";
const AUTH_VALID_DAYS = 30;

function isAuthValid() {
  if (typeof window === "undefined") return false;
  const auth = localStorage.getItem(AUTH_KEY);
  const dateStr = localStorage.getItem(AUTH_DATE_KEY);
  if (auth !== "true" || !dateStr) return false;
  const authDate = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < AUTH_VALID_DAYS;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [authorized, setAuthorized] = React.useState(false);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (isAuthValid()) {
      setAuthorized(true);
    }
    setCheckingAuth(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      localStorage.setItem(AUTH_KEY, "true");
      localStorage.setItem(AUTH_DATE_KEY, new Date().toISOString());
      setAuthorized(true);
      setError("");
    } else {
      setError("Неверный пароль");
    }
  };

  if (checkingAuth) {
    return null; // Можно показать спиннер при желании
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#111" }}>
        <form onSubmit={handleSubmit} style={{ background: "#222", padding: 32, borderRadius: 12, boxShadow: "0 2px 16px #0006" }}>
          <h2 style={{ color: "#fff", marginBottom: 16 }}>Вход на главную страницу</h2>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Введите пароль"
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444", width: 200, marginBottom: 12 }}
            autoFocus
          />
          <br />
          <button type="submit" style={{ padding: "8px 20px", borderRadius: 4, background: "#0070f3", color: "#fff", border: "none" }}>
            Войти
          </button>
          {error && <div style={{ color: "#ff5555", marginTop: 12 }}>{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
        <h1 className="text-3xl font-bold">{t("home.title")}</h1>
        <p className="text-muted-foreground">{t("home.subtitle")}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <SupabaseStatus />
        </div>
      </header>

      <OfflineNotice />

      <div className="mb-8">
        <Card className="bg-[#eeffbd] shadow-md">
          <CardHeader>
            <CardTitle>{t("home.newMatch")}</CardTitle>
            <CardDescription>{t("home.newMatchDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-4">
                <Link href="/new-match?type=padel" className="block">
                  <Button
                    className="w-full shadow-md bg-gradient-to-r from-[#1164a5] to-[#0875c9] text-white 
                    transition-all duration-300 hover:scale-105 hover:shadow-lg hover:brightness-110 
                    active:scale-95 active:shadow-inner"
                  >
                    {t("home.padel")}
                  </Button>
                </Link>
              </div>
              <Link href="/players" className="block">
                <Button
                  variant="outline"
                  className="w-full shadow-md transition-all duration-300 hover:scale-105 
                  hover:shadow-lg hover:bg-gray-100 active:scale-95 active:shadow-inner"
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t("home.managePlayers")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Активные матчи */}
      <Card className="mb-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-green-50 shadow-md">
        <CardHeader>
          <CardTitle>{t("home.activeMatches")}</CardTitle>
          <CardDescription>{t("home.activeMatchesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="bg-gradient-to-br from-blue-50 via-indigo-50 to-green-50 shadow-md rounded-b-lg">
          <MatchList limit={12} />
          <div className="mt-4">
            <Link href="/history" className="block">
              <Button
                className="w-full shadow-md bg-gradient-to-r from-[#1164a5] to-[#0875c9] text-white 
                transition-all duration-300 hover:scale-105 hover:shadow-lg hover:brightness-110 
                active:scale-95 active:shadow-inner"
              >
                <History className="h-4 w-4 mr-2" />
                {t("home.matchHistory")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Статус кортов - перемещен под активные матчи */}
      <div className="mb-6">
        <CourtsList />
      </div>

      {/* Присоединиться к матчу - перемещен под статус кортов */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("home.joinMatch")}</CardTitle>
          <CardDescription>{t("home.joinMatchDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Link href="/join-match" className="block">
              <Button
                className="w-full shadow-md bg-gradient-to-r from-[#1164a5] to-[#0875c9] text-white 
                transition-all duration-300 hover:scale-105 hover:shadow-lg hover:brightness-110 
                active:scale-95 active:shadow-inner"
              >
                {t("home.joinByCode")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Кнопка диагностики - перемещена в самый низ */}
      <div className="text-center mt-8">
        <Link href="/debug" className="inline-block">
          <Button
            variant="outline"
            size="sm"
            className="transition-all duration-300 hover:scale-105 hover:shadow-sm active:scale-95"
          >
            <Bug className="h-4 w-4 mr-2" />
            {t("home.diagnostics")}
          </Button>
        </Link>
      </div>
    </div>
  )
}
