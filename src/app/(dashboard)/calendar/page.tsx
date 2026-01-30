"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PostSummary {
  id: string;
  text: string;
  statusGlobal: string;
  scheduledAtUtc: string | null;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [view, setView] = useState<"month" | "week">("month");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    fetch(
      `/api/posts?status=SCHEDULED&from=${start.toISOString()}&to=${end.toISOString()}`
    )
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {});
  }, [year, month]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const monthName = currentDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday start

  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  function getPostsForDay(day: number) {
    return posts.filter((p) => {
      if (!p.scheduledAtUtc) return false;
      const d = new Date(p.scheduledAtUtc);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  // Week view helpers
  const today = new Date();
  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendário</h1>
        <div className="flex gap-2">
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
          >
            Mês
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
          >
            Semana
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              &larr;
            </Button>
            <CardTitle className="capitalize">{monthName}</CardTitle>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              &rarr;
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {view === "month" ? (
            <div className="grid grid-cols-7 gap-1">
              {dayNames.map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-gray-500">
                  {d}
                </div>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = getPostsForDay(day);
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                return (
                  <div
                    key={day}
                    className={`min-h-[60px] rounded-md border p-1 text-sm ${
                      isToday ? "border-blue-300 bg-blue-50" : "border-gray-100"
                    }`}
                  >
                    <span className={`text-xs ${isToday ? "font-bold text-blue-600" : "text-gray-600"}`}>
                      {day}
                    </span>
                    {dayPosts.map((p) => (
                      <Link
                        key={p.id}
                        href={`/history/${p.id}`}
                        className="mt-0.5 block truncate rounded bg-blue-100 px-1 text-xs text-blue-700 hover:bg-blue-200"
                      >
                        {p.text.slice(0, 20)}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                const dayPosts = getPostsForDay(d.getDate());
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <div
                    key={i}
                    className={`min-h-[120px] rounded-md border p-2 ${
                      isToday ? "border-blue-300 bg-blue-50" : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500">
                      {dayNames[i]} {d.getDate()}
                    </p>
                    {dayPosts.map((p) => (
                      <Link
                        key={p.id}
                        href={`/history/${p.id}`}
                        className="mt-1 block truncate rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                      >
                        {p.text.slice(0, 30)}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
