import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface GuildSettings {
  guildId: string;
  prefix: string;
  welcomeChannel: string | null;
  welcomeMessage: string | null;
  logChannel: string | null;
  autoRole: string | null;
}

export function Dashboard() {
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const queryClient = useQueryClient();

  const { data: guilds, isLoading: isLoadingGuilds } = useQuery<Guild[]>({
    queryKey: ["guilds"],
    queryFn: async () => {
      const response = await fetch("/api/guilds");
      if (!response.ok) {
        throw new Error("Failed to fetch guilds");
      }
      return response.json();
    },
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery<GuildSettings>({
    queryKey: ["settings", selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild) return null;
      const response = await fetch(`/api/guilds/${selectedGuild.id}/settings`);
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
    enabled: !!selectedGuild,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<GuildSettings>) => {
      if (!selectedGuild) throw new Error("No guild selected");
      const response = await fetch(`/api/guilds/${selectedGuild.id}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", selectedGuild?.id] });
    },
  });

  const handleUpdateSettings = (newSettings: Partial<GuildSettings>) => {
    updateSettingsMutation.mutate(newSettings);
  };

  if (isLoadingGuilds) {
    return <div>Loading guilds...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Guild List */}
            <div className="lg:col-span-1">
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-medium text-gray-900">Your Servers</h2>
                <div className="mt-4 space-y-2">
                  {guilds?.map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => setSelectedGuild(guild)}
                      className={`flex w-full items-center space-x-3 rounded-lg p-3 text-left hover:bg-gray-50 ${
                        selectedGuild?.id === guild.id ? "bg-gray-100" : ""
                      }`}
                    >
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                          alt={guild.name}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                          <span className="text-lg font-medium text-gray-500">
                            {guild.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {guild.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <div className="lg:col-span-3">
              {selectedGuild ? (
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">
                      Settings for {selectedGuild.name}
                    </h2>
                    {selectedGuild.owner && (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Owner
                      </span>
                    )}
                  </div>

                  {isLoadingSettings ? (
                    <div>Loading settings...</div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label
                          htmlFor="prefix"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Command Prefix
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="prefix"
                            id="prefix"
                            value={settings?.prefix || "!"}
                            onChange={(e) =>
                              handleUpdateSettings({ prefix: e.target.value })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="welcomeChannel"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Welcome Channel
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="welcomeChannel"
                            id="welcomeChannel"
                            value={settings?.welcomeChannel || ""}
                            onChange={(e) =>
                              handleUpdateSettings({
                                welcomeChannel: e.target.value,
                              })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Channel ID"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="welcomeMessage"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Welcome Message
                        </label>
                        <div className="mt-1">
                          <textarea
                            name="welcomeMessage"
                            id="welcomeMessage"
                            rows={3}
                            value={settings?.welcomeMessage || ""}
                            onChange={(e) =>
                              handleUpdateSettings({
                                welcomeMessage: e.target.value,
                              })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Welcome {user} to {server}!"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="logChannel"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Log Channel
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="logChannel"
                            id="logChannel"
                            value={settings?.logChannel || ""}
                            onChange={(e) =>
                              handleUpdateSettings({ logChannel: e.target.value })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Channel ID"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="autoRole"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Auto Role
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="autoRole"
                            id="autoRole"
                            value={settings?.autoRole || ""}
                            onChange={(e) =>
                              handleUpdateSettings({ autoRole: e.target.value })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Role ID"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() =>
                            handleUpdateSettings({
                              prefix: settings?.prefix,
                              welcomeChannel: settings?.welcomeChannel,
                              welcomeMessage: settings?.welcomeMessage,
                              logChannel: settings?.logChannel,
                              autoRole: settings?.autoRole,
                            })
                          }
                          disabled={updateSettingsMutation.isPending}
                        >
                          {updateSettingsMutation.isPending
                            ? "Saving..."
                            : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-white p-6 text-center shadow">
                  <p className="text-gray-500">
                    Select a server to view and edit its settings
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 