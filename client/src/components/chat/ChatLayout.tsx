import * as React from "react";

export function ChatLayout(props: {
    sidebar: React.ReactNode;
    navbar: React.ReactNode;
    footer: React.ReactNode;
    children: React.ReactNode;
    sidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
}) {
    return (
        <div className="drawer md:drawer-open">
            <input
                id="chat-drawer"
                type="checkbox"
                className="drawer-toggle"
                checked={props.sidebarOpen}
                onChange={(e) => props.setSidebarOpen(e.target.checked)}
            />

            <div className="drawer-content flex flex-col h-screen overflow-hidden">
                {/* Navbar */}
                <div className="flex-none">
                    {props.navbar}
                </div>

                {/* Main Content Area (Scrollable) */}
                <div className="flex-1 overflow-y-auto bg-base-100 p-4 scroll-smooth">
                    <div className="mx-auto max-w-3xl pb-4">
                        {props.children}
                    </div>
                </div>

                {/* Footer / Composer (Fixed at bottom) */}
                <div className="flex-none border-t border-base-200 bg-base-100 p-4">
                    <div className="mx-auto max-w-3xl">
                        {props.footer}
                    </div>
                </div>
            </div>

            {/* Sidebar Drawer */}
            <div className="drawer-side z-20 h-full">
                <label
                    htmlFor="chat-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                    onClick={() => props.setSidebarOpen(false)}
                ></label>
                {props.sidebar}
            </div>
        </div>
    );
}