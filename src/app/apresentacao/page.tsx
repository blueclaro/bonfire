"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function PresentationPage() {
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const destination = new URL("/conta-temporaria", window.location.origin).href;
    setUrl(destination);
    void QRCode.toDataURL(destination, { width: 640, margin: 4, errorCorrectionLevel: "M" })
      .then(result => { if (live) setImage(result); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#11100f] p-6 text-center text-[#f6efe7]">
    <h1 className="text-4xl font-black md:text-6xl">Experimente o Bonfire!</h1>
    <p className="max-w-xl text-xl text-[#b9aaa0]">Aponte a câmera, escolha seu nome e uma tag e participe da conversa.</p>
    {image ? <img src={image} width={360} height={360} alt="QR Code para criar sua conta temporária no Bonfire" className="h-auto w-full max-w-sm rounded-xl" /> : <p role="status">{error ? "Use o endereço abaixo para entrar." : "Gerando QR Code…"}</p>}
    <Link href="/conta-temporaria" className="break-all text-lg text-[#ffd19a] underline">{url || "Criar conta temporária"}</Link>
    <p>Sem e-mail. Sem senha. Válida por 24 horas.</p>
    {image && <a href={image} download="bonfire-qrcode.png" className="text-sm underline">Baixar QR Code para os slides</a>}
    <Link href="/" className="text-sm text-[#b9aaa0]">Voltar ao site</Link>
  </main>;
}
