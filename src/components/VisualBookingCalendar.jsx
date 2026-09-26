import React, { useEffect, useState, useMemo, useCallback } from "react";
import { api, brl, fmtErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  LayoutGrid,
  Columns,
  User,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

/**
 * VisualBookingCalendar Component
 *
 * @param {Object} props
 * @param {string} [props.initialDay] - Initial date (YYYY-MM-DD)
 * @param {string} [props.selectedServiceId] - Pre-selected service ID
 * @param {string} [props.selectedProId] - Pre-selected professional ID
 * @param {string} [props.studioSlug] - Studio slug (optional)
 * @param {Array} [props.services] - List of studio services (optional, will fetch if not passed)
 * @param {Function} [props.onSelectSlot] - Callback when customer selects a slot: ({ professional, slot, startIso, time, day, service }) => void
 * @param {string} [props.selectedSlotIso] - Currently active selected slot ISO
 * @param {boolean} [props.compact] - Compact mode flag
 */
export default function VisualBookingCalendar({
  initialDay,
  selectedServiceId = "",
  selectedProId = "",
  studioSlug = "",
  services: propServices = null,
  onSelectSlot,
  selectedSlotIso = "",
  compact = false,
}) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [currentDay, setCurrentDay] = useState(initialDay || todayStr);
  const [activeServiceId, setActiveServiceId] = useState(selectedServiceId);
  const [activeProId, setActiveProId] = useState(selectedProId);
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "matrix"
  const [calendarData, setCalendarData] = useState(null);
  const [servicesList, setServicesList] = useState(propServices || []);
  const [loading, setLoading] = useState(true);
  const [chosenSlot, setChosenSlot] = useState(null);

  // Sync prop changes
  useEffect(() => {
    if (selectedServiceId) setActiveServiceId(selectedServiceId);
  }, [selectedServiceId]);

  useEffect(() => {
    if (selectedProId) setActiveProId(selectedProId);
  }, [selectedProId]);

  // Load services if not provided
  useEffect(() => {
    if (!propServices) {
      api.get("/services")
        .then((r) => setServicesList(r.data.filter((s) => s.active !== false)))
        .catch(() => {});
    }
  }, [propServices]);

  // Fetch calendar availability
  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        day: currentDay,
      };
      if (activeServiceId) params.service_id = activeServiceId;
      if (activeProId) params.professional_id = activeProId;
      if (studioSlug) params.studio_slug = studioSlug;

      const { data } = await api.get("/availability/calendar", { params });
      setCalendarData(data);
    } catch (err) {
      toast.error(fmtErr(err.response?.data?.detail) || "Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  }, [currentDay, activeServiceId, activeProId, studioSlug]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // Date navigation helpers
  const handlePrevDay = () => {
    const d = new Date(`${currentDay}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    setCurrentDay(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(`${currentDay}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    setCurrentDay(d.toISOString().slice(0, 10));
  };

  const handleGoToday = () => {
    setCurrentDay(todayStr);
  };

  // Find next day with available openings
  const handleFindNextOpening = () => {
    if (!calendarData?.days_summary) return;
    const nextWithOpenings = calendarData.days_summary.find(
      (d) => d.date !== currentDay && d.total_openings > 0
    );
    if (nextWithOpenings) {
      setCurrentDay(nextWithOpenings.date);
    } else {
      // Jump 7 days ahead
      const d = new Date(`${currentDay}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      setCurrentDay(d.toISOString().slice(0, 10));
    }
  };

  const handleSlotClick = (pro, slot) => {
    const selectedSvc = servicesList.find((s) => s.id === activeServiceId) || pro.services?.[0] || null;
    const payload = {
      professional: pro,
      slot,
      startIso: slot.start,
      time: slot.time,
      day: currentDay,
      service: selectedSvc,
    };
    setChosenSlot(payload);
    onSelectSlot?.(payload);
  };

  // Format date display
  const formattedHeaderDate = useMemo(() => {
    try {
      const d = new Date(`${currentDay}T12:00:00Z`);
      return d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return currentDay;
    }
  }, [currentDay]);

  const activeService = useMemo(
    () => servicesList.find((s) => s.id === activeServiceId),
    [servicesList, activeServiceId]
  );

  const prosList = calendarData?.professionals || [];
  const daysSummary = calendarData?.days_summary || [];

  // Matrix hours list (all unique times generated across pros)
  const matrixHours = useMemo(() => {
    const timesSet = new Set();
    prosList.forEach((p) => {
      (p.slots || []).forEach((s) => timesSet.add(s.time));
    });
    return Array.from(timesSet).sort();
  }, [prosList]);

  return (
    <div className="w-full space-y-6" data-testid="visual-booking-calendar">
      {/* 1. Header with Controls and Date Navigation */}
      <div className="bg-card border border-border/70 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-medium">
              <CalendarIcon size={14} />
              <span>Agenda Visual de Vagas</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl capitalize mt-1 text-foreground">
              {formattedHeaderDate}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>{calendarData?.studio_name || "Studio"}</span>
              <span aria-hidden="true">·</span>
              <span>{prosList.reduce((acc, p) => acc + (p.total_openings || 0), 0)} vagas abertas</span>
            </div>
          </div>

          {/* Day Stepper + View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-xl bg-secondary/60 p-1 border border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevDay}
                className="h-8 w-8 p-0 rounded-lg hover:bg-background"
                title="Dia anterior"
                data-testid="cal-prev-day"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoToday}
                className={`h-8 px-2.5 text-xs font-medium rounded-lg hover:bg-background ${currentDay === todayStr ? "bg-background text-primary shadow-xs" : ""}`}
                data-testid="cal-go-today"
              >
                Hoje
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextDay}
                className="h-8 w-8 p-0 rounded-lg hover:bg-background"
                title="Próximo dia"
                data-testid="cal-next-day"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            {/* Input date picker for custom date jump */}
            <div className="relative">
              <input
                type="date"
                value={currentDay}
                onChange={(e) => e.target.value && setCurrentDay(e.target.value)}
                className="h-9 px-3 py-1.5 text-xs rounded-xl bg-secondary/60 border border-border/50 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                title="Escolher data específica"
                data-testid="cal-native-date"
              />
            </div>

            {/* Mode switch (Cards vs Grid) */}
            <div className="hidden sm:inline-flex items-center rounded-xl bg-secondary/60 p-1 border border-border/50">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${viewMode === "cards" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                title="Ver por cartões de profissionais"
                data-testid="cal-view-cards"
              >
                <Columns size={13} />
                <span>Profissionais</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${viewMode === "matrix" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                title="Ver grade comparativa de horários"
                data-testid="cal-view-matrix"
              >
                <LayoutGrid size={13} />
                <span>Grade Geral</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. 7-Day Horizontal Strip Carousel */}
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto pb-1" data-testid="cal-days-strip">
            {daysSummary.map((d) => {
              const isSelected = d.date === currentDay;
              const isToday = d.date === todayStr;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setCurrentDay(d.date)}
                  data-testid={`cal-day-${d.date}`}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer min-w-[3.5rem] ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                      : d.has_openings
                      ? "bg-secondary/40 hover:bg-secondary border-border/70 text-foreground"
                      : "bg-muted/20 border-border/30 text-muted-foreground opacity-60"
                  }`}
                >
                  <span className={`text-[11px] font-medium tracking-wide uppercase ${isSelected ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    {d.weekday_short}
                  </span>
                  <span className="font-display text-lg sm:text-xl font-bold my-0.5">
                    {d.day_num}
                  </span>
                  <span className={`text-[10px] tracking-tight font-mono ${
                    isSelected
                      ? "text-primary-foreground/90 font-medium"
                      : d.has_openings
                      ? "text-primary font-medium"
                      : "text-muted-foreground/80"
                  }`}>
                    {d.has_openings ? `${d.total_openings} vagas` : "Fechado"}
                  </span>
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-primary mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Filters: Services & Professional Tabs */}
        <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Service Filter */}
          {servicesList.length > 0 && (
            <div className="flex items-center gap-2 min-w-[220px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Procedimento:</span>
              <Select value={activeServiceId || "all"} onValueChange={(v) => setActiveServiceId(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary/30 rounded-lg border-border/60" data-testid="cal-service-filter">
                  <SelectValue placeholder="Todos os procedimentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os procedimentos</SelectItem>
                  {servicesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_min} min — {brl(s.price)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Professional Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setActiveProId("")}
              data-testid="cal-pro-all"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                !activeProId
                  ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                  : "bg-secondary/30 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} />
                Todas profissionais
              </span>
            </button>
            {prosList.map((p) => {
              const isActive = activeProId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProId(isActive ? "" : p.id)}
                  data-testid={`cal-pro-${p.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                    isActive
                      ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                      : "bg-secondary/30 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                    {p.name.charAt(0)}
                  </span>
                  <span>{p.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">({p.total_openings})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Main Availability View */}
      {loading ? (
        <Card className="p-12 text-center border-border/60 bg-card/60">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <div className="text-sm font-medium text-muted-foreground">Consultando horários disponíveis…</div>
          </div>
        </Card>
      ) : prosList.length === 0 || prosList.every((p) => p.total_openings === 0) ? (
        <Card className="p-8 sm:p-12 text-center border-border/60 bg-card/60 space-y-4">
          <div className="w-12 h-12 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-display text-xl">Nenhuma vaga para esta data</h3>
            <p className="text-sm text-muted-foreground">
              Não encontramos horários livres para {formattedHeaderDate}. Que tal consultar o próximo dia com vagas disponíveis?
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleFindNextOpening}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-5"
            >
              Ver próximo dia disponível
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleNextDay}
              className="rounded-full text-xs"
            >
              Ver dia seguinte
            </Button>
          </div>
        </Card>
      ) : viewMode === "cards" ? (
        /* ======================== MODE A: CARDS POR PROFISSIONAL ======================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="cal-cards-container">
          {prosList.map((pro) => {
            const hasSlots = pro.total_openings > 0;
            return (
              <Card
                key={pro.id}
                data-testid={`cal-card-${pro.id}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  hasSlots ? "bg-card border-border/80 shadow-xs hover:border-primary/40" : "bg-card/40 border-border/30 opacity-70"
                }`}
              >
                <div className="space-y-4">
                  {/* Pro Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      {pro.photo_url ? (
                        <img
                          src={pro.photo_url}
                          alt={pro.name}
                          className="w-11 h-11 rounded-full object-cover border border-primary/30"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-secondary text-primary font-bold text-base flex items-center justify-center border border-border">
                          {pro.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-display text-lg font-semibold leading-tight text-foreground">
                          {pro.name}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {pro.specialty}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-md font-medium ${
                        hasSlots ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"
                      }`}>
                        {pro.total_openings} {pro.total_openings === 1 ? "vaga" : "vagas"}
                      </span>
                    </div>
                  </div>

                  {/* Slots Periods */}
                  {!hasSlots ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Sem horários livres nesta data.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Manhã */}
                      {pro.periods.morning?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            <Sun size={12} className="text-amber-400" />
                            <span>Manhã (09h – 12h)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {pro.periods.morning.map((slot) => {
                              const isSelected = selectedSlotIso === slot.start || chosenSlot?.startIso === slot.start;
                              return (
                                <button
                                  key={slot.start}
                                  type="button"
                                  onClick={() => handleSlotClick(pro, slot)}
                                  data-testid={`slot-${pro.id}-${slot.time}`}
                                  className={`px-2 py-2 rounded-xl text-xs font-mono font-medium text-center transition-all cursor-pointer border ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105 font-bold"
                                      : "bg-secondary/40 hover:bg-primary/10 hover:border-primary/50 text-foreground border-border/70"
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tarde */}
                      {pro.periods.afternoon?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            <Sunset size={12} className="text-orange-400" />
                            <span>Tarde (12h – 18h)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {pro.periods.afternoon.map((slot) => {
                              const isSelected = selectedSlotIso === slot.start || chosenSlot?.startIso === slot.start;
                              return (
                                <button
                                  key={slot.start}
                                  type="button"
                                  onClick={() => handleSlotClick(pro, slot)}
                                  data-testid={`slot-${pro.id}-${slot.time}`}
                                  className={`px-2 py-2 rounded-xl text-xs font-mono font-medium text-center transition-all cursor-pointer border ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105 font-bold"
                                      : "bg-secondary/40 hover:bg-primary/10 hover:border-primary/50 text-foreground border-border/70"
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Noite */}
                      {pro.periods.evening?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            <Moon size={12} className="text-indigo-400" />
                            <span>Noite (após 18h)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {pro.periods.evening.map((slot) => {
                              const isSelected = selectedSlotIso === slot.start || chosenSlot?.startIso === slot.start;
                              return (
                                <button
                                  key={slot.start}
                                  type="button"
                                  onClick={() => handleSlotClick(pro, slot)}
                                  data-testid={`slot-${pro.id}-${slot.time}`}
                                  className={`px-2 py-2 rounded-xl text-xs font-mono font-medium text-center transition-all cursor-pointer border ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105 font-bold"
                                      : "bg-secondary/40 hover:bg-primary/10 hover:border-primary/50 text-foreground border-border/70"
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer with services list snippet */}
                {pro.services?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/30 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span className="truncate max-w-[180px]">
                      {pro.services.map((s) => s.name).join(" · ")}
                    </span>
                    <span className="shrink-0 text-foreground font-medium">
                      a partir de {brl(pro.services[0].price)}
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* ======================== MODE B: GRADE COMPARATIVA (MATRIX/TIMELINE) ======================== */
        <Card className="p-4 sm:p-6 rounded-2xl border-border/70 overflow-x-auto" data-testid="cal-matrix-container">
          <div className="min-w-[600px] space-y-2">
            <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(140px,1fr))] gap-2 pb-3 border-b border-border/60 items-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Horário
              </div>
              {prosList.map((p) => (
                <div key={p.id} className="text-center space-y-0.5">
                  <div className="font-semibold text-sm text-foreground">{p.name}</div>
                  <div className="text-[11px] text-primary font-mono">{p.total_openings} livres</div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-border/30">
              {matrixHours.map((timeStr) => (
                <div
                  key={timeStr}
                  className="grid grid-cols-[100px_repeat(auto-fit,minmax(140px,1fr))] gap-2 py-2 items-center hover:bg-secondary/20 transition-colors rounded-lg px-1"
                >
                  <div className="text-xs font-mono font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{timeStr}</span>
                  </div>

                  {prosList.map((pro) => {
                    const slot = (pro.slots || []).find((s) => s.time === timeStr);
                    const isSelected = slot && (selectedSlotIso === slot.start || chosenSlot?.startIso === slot.start);

                    if (!slot) {
                      return (
                        <div key={pro.id} className="text-center">
                          <span className="text-[11px] text-muted-foreground/40 font-mono select-none">—</span>
                        </div>
                      );
                    }

                    return (
                      <div key={pro.id} className="text-center">
                        <button
                          type="button"
                          onClick={() => handleSlotClick(pro, slot)}
                          data-testid={`matrix-slot-${pro.id}-${timeStr}`}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition-all border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-secondary/50 hover:bg-primary/10 hover:border-primary/40 text-foreground border-border/60"
                          }`}
                        >
                          Disponível
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 5. Sticky/Floating Bottom Confirmation Bar when a slot is chosen */}
      {chosenSlot && (
        <div
          className="sticky bottom-4 z-40 bg-card/95 backdrop-blur-md border border-primary/40 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
          data-testid="cal-selection-bar"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/30">
              <Check size={18} />
            </div>
            <div>
              <div className="text-xs font-medium text-primary uppercase tracking-wider">
                Horário Selecionado
              </div>
              <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <span>{chosenSlot.professional.name}</span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="font-mono text-primary">{chosenSlot.time}</span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {new Date(`${chosenSlot.day}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                </span>
              </div>
              {chosenSlot.service && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {chosenSlot.service.name} ({chosenSlot.service.duration_min} min — {brl(chosenSlot.service.price)})
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setChosenSlot(null)}
              className="text-xs rounded-xl"
            >
              Trocar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSelectSlot?.(chosenSlot);
                toast.success(`Horário das ${chosenSlot.time} com ${chosenSlot.professional.name} selecionado!`);
              }}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-5 shadow-xs font-medium"
              data-testid="cal-confirm-slot"
            >
              Confirmar Escolha
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
