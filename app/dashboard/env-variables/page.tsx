"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, Plus, Trash2, Save } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Repository {
  id: number;
  name: string;
  full_name: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export default function EnvironmentVariablesPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string>("");
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecretValues, setShowSecretValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepository) {
      fetchEnvironmentVariables();
    } else {
      setVariables([]);
    }
  }, [selectedRepository]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/github/repositories");
      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }
      const data = await response.json();
      setRepositories(data);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      toast.error("Failed to load repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEnvironmentVariables = async () => {
    if (!selectedRepository) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/env-variables?repository=${selectedRepository}`);
      if (!response.ok) {
        throw new Error("Failed to fetch environment variables");
      }
      const data = await response.json();
      
      // Initialize with empty values for security
      const formattedVariables = data.map((variable: any) => ({
        id: uuidv4(),
        key: variable.key,
        value: variable.isSecret ? "" : variable.value,
        isSecret: variable.isSecret,
      }));
      
      setVariables(formattedVariables);
      setError(null);
    } catch (error) {
      console.error("Error fetching environment variables:", error);
      setError("Failed to load environment variables");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      {
        id: uuidv4(),
        key: "",
        value: "",
        isSecret: false,
      },
    ]);
  };

  const handleRemoveVariable = (id: string) => {
    setVariables(variables.filter((variable) => variable.id !== id));
  };

  const handleVariableChange = (id: string, field: keyof EnvironmentVariable, value: string | boolean) => {
    setVariables(
      variables.map((variable) =>
        variable.id === id ? { ...variable, [field]: value } : variable
      )
    );
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecretValues({
      ...showSecretValues,
      [id]: !showSecretValues[id],
    });
  };

  const handleSave = async () => {
    // Validate input
    const emptyKeys = variables.some((variable) => !variable.key.trim());
    if (emptyKeys) {
      toast.error("All environment variables must have a key");
      return;
    }

    // Check for duplicate keys
    const keys = variables.map((variable) => variable.key);
    const hasDuplicates = keys.some((key, index) => keys.indexOf(key) !== index);
    if (hasDuplicates) {
      toast.error("Duplicate environment variable keys are not allowed");
      return;
    }

    if (!selectedRepository) {
      toast.error("Please select a repository");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/env-variables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repository: selectedRepository,
          variables: variables.map((variable) => ({
            key: variable.key,
            value: variable.value,
            isSecret: variable.isSecret,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save environment variables");
      }

      toast.success("Environment variables saved successfully");
      setError(null);
    } catch (error: any) {
      console.error("Error saving environment variables:", error);
      setError(error.message || "Failed to save environment variables");
      toast.error(error.message || "Failed to save environment variables");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Environment Variables</h1>
        <p className="text-muted-foreground">
          Manage environment variables for your deployments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repository Environment Variables</CardTitle>
          <CardDescription>
            Add environment variables that will be injected during the build process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="repository">Select Repository</Label>
            <Select
              value={selectedRepository}
              onValueChange={setSelectedRepository}
              disabled={isLoading}
            >
              <SelectTrigger id="repository" className="w-full">
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo) => (
                  <SelectItem key={repo.id} value={repo.full_name}>
                    {repo.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-destructive mr-2 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 dark:bg-amber-900/20 dark:border-amber-800">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-400">About Environment Variables</h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 list-disc pl-5 space-y-1">
                  <li>Variables are encrypted and stored securely</li>
                  <li>For React apps, variables must start with <code className="bg-amber-100 dark:bg-amber-800/50 px-1 py-0.5 rounded">REACT_APP_</code></li>
                  <li>Secret variables are hidden in the UI but available during build</li>
                  <li>Changes take effect on the next deployment</li>
                </ul>
              </div>
            </div>
          </div>

          {selectedRepository && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Variables</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariable}
                  disabled={isLoading || isSaving}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>

              {variables.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-md">
                  <p className="text-muted-foreground">No environment variables yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddVariable}
                    className="mt-4"
                    disabled={isLoading || isSaving}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {variables.map((variable) => (
                    <div
                      key={variable.id}
                      className="grid grid-cols-12 gap-4 items-start border p-4 rounded-md"
                    >
                      <div className="col-span-5">
                        <Label htmlFor={`key-${variable.id}`} className="mb-2 block">
                          Key
                        </Label>
                        <Input
                          id={`key-${variable.id}`}
                          value={variable.key}
                          onChange={(e) =>
                            handleVariableChange(variable.id, "key", e.target.value)
                          }
                          placeholder="REACT_APP_API_URL"
                          disabled={isLoading || isSaving}
                        />
                      </div>
                      <div className="col-span-5">
                        <Label htmlFor={`value-${variable.id}`} className="mb-2 block">
                          Value
                        </Label>
                        <div className="relative">
                          <Input
                            id={`value-${variable.id}`}
                            type={
                              variable.isSecret && !showSecretValues[variable.id]
                                ? "password"
                                : "text"
                            }
                            value={variable.value}
                            onChange={(e) =>
                              handleVariableChange(variable.id, "value", e.target.value)
                            }
                            placeholder="https://api.example.com"
                            disabled={isLoading || isSaving}
                          />
                          {variable.isSecret && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => toggleSecretVisibility(variable.id)}
                            >
                              {showSecretValues[variable.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-1 flex items-end">
                        <div className="flex items-center space-x-2 h-10">
                          <Switch
                            id={`secret-${variable.id}`}
                            checked={variable.isSecret}
                            onCheckedChange={(checked) =>
                              handleVariableChange(variable.id, "isSecret", checked)
                            }
                            disabled={isLoading || isSaving}
                          />
                          <Label htmlFor={`secret-${variable.id}`} className="text-xs">
                            Secret
                          </Label>
                        </div>
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveVariable(variable.id)}
                          disabled={isLoading || isSaving}
                          className="h-10 w-10 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!selectedRepository || isLoading || isSaving || variables.length === 0}
            className="ml-auto"
          >
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Variables
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Environment Variables Work</CardTitle>
          <CardDescription>
            Understanding how environment variables are used in your deployments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">For React Applications</h3>
            <p className="text-sm text-muted-foreground">
              React applications require environment variables to be prefixed with <code className="bg-muted px-1 py-0.5 rounded">REACT_APP_</code>. 
              These variables will be available in your code as <code className="bg-muted px-1 py-0.5 rounded">process.env.REACT_APP_*</code>.
            </p>
            <div className="bg-muted p-4 rounded-md text-sm font-mono">
              <p>// Example usage in React</p>
              <p>const apiUrl = process.env.REACT_APP_API_URL;</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">For Static Websites</h3>
            <p className="text-sm text-muted-foreground">
              For static websites using build tools like Vite or Webpack, environment variables are typically accessed through 
              <code className="bg-muted px-1 py-0.5 rounded">import.meta.env</code> or a similar mechanism depending on your build tool.
            </p>
            <div className="bg-muted p-4 rounded-md text-sm font-mono">
              <p>// Example usage in Vite</p>
              <p>const apiKey = import.meta.env.VITE_API_KEY;</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Security Considerations</h3>
            <p className="text-sm text-muted-foreground">
              Remember that all environment variables in client-side applications are included in the built bundle and are 
              publicly accessible. Only use environment variables for non-sensitive configuration or public API keys.
            </p>
            <p className="text-sm text-muted-foreground">
              For truly sensitive information, consider using a backend service or API with proper authentication.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 