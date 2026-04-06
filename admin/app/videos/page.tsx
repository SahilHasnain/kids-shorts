import AdminHeader from "@/components/AdminHeader";
import VideoUpload from "@/components/VideoUpload";

export default function VideosPage() {
    return (
        <>
            <AdminHeader />
            <div className="min-h-screen bg-neutral-900 text-white">
                <VideoUpload />
            </div>
        </>
    );
}
