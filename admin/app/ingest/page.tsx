import AdminHeader from "@/components/AdminHeader";
import SpeechIngest from "@/components/SpeechIngest";

export default function IngestPage() {
    return (
        <>
            <AdminHeader />
            <div className="min-h-screen bg-neutral-900 text-white">
                <SpeechIngest />
            </div>
        </>
    );
}
