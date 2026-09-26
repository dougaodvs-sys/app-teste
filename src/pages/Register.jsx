import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, fmtErr } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Register() {
  const { register, registerStudio } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialTab = params.get("tipo") === "studio" ? "studio" : "client";
  const [tab, setTab] = useState(initialTab);

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", referral_code: params.get("ref") || "" });
  const [studioForm, setStudioForm] = useState({ name: "", manager_name: "", manager_phone: "", manager_email: "", manager_password: "" });
  const [busy, setBusy] = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(true);

  useEffect(() => {
    const slug = params.get("studio");
    if (!slug) return;
    api.get(`/public/studios/${encodeURIComponent(slug)}/config`).then((r) => setReferralEnabled(r.data.referral_enabled !== false)).catch(() => {});
  }, [params]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setStudio = (k) => (e) => setStudioForm({ ...studioForm, [k]: e.target.value });

  const submitClient = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register({ ...form, email: form.email || null, referral_code: referralEnabled && form.referral_code ? form.referral_code : null, studio_slug: params.get("studio") || null });
      toast.success("Conta criada com sucesso");
      nav("/inicio");
    } catch (err) {
      toast.error(fmtErr(err.response?.data?.detail) || "Falha ao criar conta");
    } finally { setBusy(false); }
  };

  const submitStudio = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await registerStudio(studioForm);
      toast.success(`Studio "${data.studio?.name}" criado com sucesso!`);
      nav("/dashboard");
    } catch (err) {
      toast.error(fmtErr(err.response?.data?.detail) || "Falha ao cadastrar studio");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-xs tracking-[0.4em] text-primary uppercase">Novo cadastro</div>
          <h2 className="font-display text-4xl mt-2">Crie sua conta</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Escolha se você é cliente para agendar ou proprietária para gerenciar seu Studio.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="client" data-testid="reg-tab-client">Sou Cliente</TabsTrigger>
            <TabsTrigger value="studio" data-testid="reg-tab-studio">Cadastrar meu Studio</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="mt-4">
            <form onSubmit={submitClient} className="space-y-4" data-testid="register-form">
              <div className="space-y-3">
                <div><Label>Nome</Label><Input data-testid="reg-name" required value={form.name} onChange={set("name")} /></div>
                <div><Label>Telefone / WhatsApp <span className="text-primary">*</span></Label><Input data-testid="reg-phone" type="tel" inputMode="tel" required minLength={8} placeholder="(11) 99999-9999" value={form.phone} onChange={set("phone")} /><p className="text-xs text-muted-foreground mt-1">Você entrará com telefone e senha.</p></div>
                <div><Label>E-mail <span className="text-muted-foreground">(opcional)</span></Label><Input data-testid="reg-email" type="email" value={form.email} onChange={set("email")} /></div>
                <div><Label>Senha</Label><Input data-testid="reg-password" type="password" required value={form.password} onChange={set("password")} /></div>
                {referralEnabled && (
                  <div>
                    <Label>Código de indicação <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input data-testid="reg-referral" placeholder="Ex.: MARIA1234" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} />
                  </div>
                )}
              </div>
              <Button data-testid="register-submit" disabled={busy} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {busy ? "Criando…" : "Criar conta de cliente"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="studio" className="mt-4">
            <form onSubmit={submitStudio} className="space-y-4" data-testid="register-studio-form">
              <div className="space-y-3">
                <div>
                  <Label>Nome do seu Studio <span className="text-primary">*</span></Label>
                  <Input data-testid="reg-studio-name" placeholder="Ex.: Studio Glamour" required value={studioForm.name} onChange={setStudio("name")} />
                </div>
                <div>
                  <Label>Seu Nome (Responsável / Gerente) <span className="text-primary">*</span></Label>
                  <Input data-testid="reg-studio-manager-name" placeholder="Ex.: Amanda Silva" required value={studioForm.manager_name} onChange={setStudio("manager_name")} />
                </div>
                <div>
                  <Label>Telefone / WhatsApp do Studio <span className="text-primary">*</span></Label>
                  <Input data-testid="reg-studio-phone" type="tel" inputMode="tel" required placeholder="(11) 99999-8888" value={studioForm.manager_phone} onChange={setStudio("manager_phone")} />
                </div>
                <div>
                  <Label>E-mail de acesso (Login do Studio) <span className="text-primary">*</span></Label>
                  <Input data-testid="reg-studio-email" type="email" required placeholder="contato@seustudio.com" value={studioForm.manager_email} onChange={setStudio("manager_email")} />
                </div>
                <div>
                  <Label>Senha de acesso <span className="text-primary">*</span></Label>
                  <Input data-testid="reg-studio-password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={studioForm.manager_password} onChange={setStudio("manager_password")} />
                  <p className="text-xs text-muted-foreground mt-1">Utilize para gerenciar profissionais, serviços e agenda.</p>
                </div>
              </div>
              <Button data-testid="register-studio-submit" disabled={busy} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {busy ? "Criando Studio…" : "Criar Studio e Acessar"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-sm text-muted-foreground text-center">
          Já tem conta? <Link data-testid="go-login" to={params.get("studio") ? `/login?studio=${encodeURIComponent(params.get("studio"))}` : "/login"} className="text-primary hover:underline">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
