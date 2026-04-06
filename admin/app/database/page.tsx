import AdminHeader from "@/components/AdminHeader";
import DatabaseInspector from "@/components/DatabaseInspector";

export default function DatabasePage() {
    return (
        <>
            <AdminHeader />
            <div className="min-h-screen bg-neutral-900 text-white">
                <DatabaseInspector />
            </div>
        </>
    );
}
