import Image from "next/image";
import AudioSyncPlayer from "@/components/AudioPlayer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
        <AudioSyncPlayer audioUrls={["808s.wav","percs.wav",'chords.wav']} />
    </main>
  );
}
