import AdminHeader from "@/components/AdminHeader";
import ChannelManagement from "@/components/ChannelManagement";

export default function ChannelsPage() {
    return (
        <>
            <AdminHeader />
            <div className="min-h-screen bg-neutral-900 text-white">
                <ChannelManagement />
            </div>
        </>
    );
}
