import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trophy, BookOpen, Headphones, Clock, Calendar, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ReadingGoal } from "@shared/schema";
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, differenceInDays, isWithinInterval } from "date-fns";

type GoalType = "books" | "pages" | "minutes" | "audiobooks";
type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";

interface GoalWithProgress extends ReadingGoal {
  percentComplete: number;
  daysRemaining: number;
  isOnTrack: boolean;
}

const goalTypeConfig = {
  books: { label: "Books", icon: BookOpen, unit: "books" },
  pages: { label: "Pages", icon: BookOpen, unit: "pages" },
  minutes: { label: "Reading Time", icon: Clock, unit: "minutes" },
  audiobooks: { label: "Audiobooks", icon: Headphones, unit: "audiobooks" },
};

const periodConfig = {
  daily: { label: "Daily", days: 1 },
  weekly: { label: "Weekly", days: 7 },
  monthly: { label: "Monthly", days: 30 },
  yearly: { label: "Yearly", days: 365 },
};

export default function Goals() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    goalType: "books" as GoalType,
    period: "monthly" as GoalPeriod,
    targetValue: 5,
  });

  const { data: goals = [], isLoading } = useQuery<ReadingGoal[]>({
    queryKey: ["/api/goals"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goal: { goalType: GoalType; period: GoalPeriod; targetValue: number }) => {
      const now = new Date();
      let startDate = now;
      let endDate: Date | undefined;

      switch (goal.period) {
        case "daily":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case "weekly":
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case "monthly":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "yearly":
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
      }

      return apiRequest("POST", "/api/goals", {
        ...goal,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString(),
        currentValue: 0,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setIsAddDialogOpen(false);
      toast({ title: "Goal created", description: "Your reading goal has been set!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create goal", variant: "destructive" });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest("DELETE", `/api/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal removed", description: "The goal has been deleted." });
    },
  });

  const calculateProgress = (goal: ReadingGoal): GoalWithProgress => {
    const percentComplete = Math.min((goal.currentValue || 0) / goal.targetValue * 100, 100);
    const now = new Date();
    const endDate = goal.endDate ? new Date(goal.endDate) : now;
    const startDate = new Date(goal.startDate);
    const daysRemaining = Math.max(differenceInDays(endDate, now), 0);
    const totalDays = differenceInDays(endDate, startDate);
    const daysElapsed = totalDays - daysRemaining;
    const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
    const isOnTrack = percentComplete >= expectedProgress - 10;

    return { ...goal, percentComplete, daysRemaining, isOnTrack };
  };

  const activeGoals = goals.filter((g) => g.isActive).map(calculateProgress);
  const completedGoals = activeGoals.filter((g) => g.percentComplete >= 100);
  const inProgressGoals = activeGoals.filter((g) => g.percentComplete < 100);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Reading Goals</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-goal">
                <Plus className="h-4 w-4 mr-2" />
                Set Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set a Reading Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Goal Type</Label>
                  <Select
                    value={newGoal.goalType}
                    onValueChange={(value: GoalType) => setNewGoal({ ...newGoal, goalType: value })}
                  >
                    <SelectTrigger data-testid="select-goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={newGoal.period}
                    onValueChange={(value: GoalPeriod) => setNewGoal({ ...newGoal, period: value })}
                  >
                    <SelectTrigger data-testid="select-goal-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(periodConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target ({goalTypeConfig[newGoal.goalType].unit})</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: parseInt(e.target.value) || 1 })}
                    data-testid="input-goal-target"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createGoalMutation.mutate(newGoal)}
                  disabled={createGoalMutation.isPending}
                  data-testid="button-create-goal"
                >
                  Create Goal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {completedGoals.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Completed Goals
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {completedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => deleteGoalMutation.mutate(goal.id)}
                />
              ))}
            </div>
          </div>
        )}

        {inProgressGoals.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">In Progress</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {inProgressGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => deleteGoalMutation.mutate(goal.id)}
                />
              ))}
            </div>
          </div>
        )}

        {activeGoals.length === 0 && (
          <Card className="p-8 text-center">
            <div className="space-y-4">
              <Target className="h-16 w-16 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No reading goals yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Set a goal to track your reading progress. Choose from books completed, 
                  pages read, or time spent reading.
                </p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-set-first-goal">
                <Plus className="h-4 w-4 mr-2" />
                Set Your First Goal
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Goal Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Start with achievable goals and gradually increase them as you build habits.</p>
            <p>Daily goals help build consistent reading habits.</p>
            <p>Track different types of goals to see your reading patterns.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoalCard({ goal, onDelete }: { goal: GoalWithProgress; onDelete: () => void }) {
  const config = goalTypeConfig[goal.goalType as GoalType];
  const periodLabel = periodConfig[goal.period as GoalPeriod]?.label || goal.period;
  const Icon = config?.icon || Target;
  const isComplete = goal.percentComplete >= 100;

  return (
    <Card className={isComplete ? "border-yellow-500/50 bg-yellow-50/10" : ""} data-testid={`goal-card-${goal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isComplete ? "bg-yellow-100 text-yellow-700" : "bg-primary/10 text-primary"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">
                {config?.label || goal.goalType}
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {periodLabel}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">Complete</Badge>}
            {!goal.isOnTrack && !isComplete && (
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">Behind</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              data-testid={`button-delete-goal-${goal.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>
            {goal.currentValue || 0} / {goal.targetValue} {config?.unit || "items"}
          </span>
          <span className="font-medium">{Math.round(goal.percentComplete)}%</span>
        </div>
        <Progress value={goal.percentComplete} className={isComplete ? "bg-yellow-200" : ""} />
        {goal.daysRemaining > 0 && !isComplete && (
          <p className="text-xs text-muted-foreground">
            {goal.daysRemaining} day{goal.daysRemaining !== 1 ? "s" : ""} remaining
          </p>
        )}
      </CardContent>
    </Card>
  );
}
