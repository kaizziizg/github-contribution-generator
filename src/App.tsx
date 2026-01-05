import { useMemo, useState } from "react";
import { DEFAULT_PALETTE, FONT_5X7 } from "./utils/constant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { buildYearDateGrid, clamp, makeEmptyGrid, rasterizeText5x7 } from "./utils/dateGrid";
import { formatISODate, inYear, type WeekStart } from "./utils/date";
import { generateRepo } from "./api";

interface RepoInfo {
  repoName: string;
  user: string;
  email: string;
  total: number;
  contributions: Array<{
    date: string;
    count: number;
    time: string;
  }>;
}

type RenderArgs = {
  text: string;
  commitTimes: number; // color 1..4
  xOffsetWeeks: number;
  yOffsetDays: number;
  scale: number; // deprecated
  spacing: number; // character spacing
  invert: boolean;
  noise: number; // 0..1
  year: number;
  dates: Date[][];
};

function generateRepoInfo(
  grid: number[][],
  dates: Date[][],
  repoName: string,
  user: string,
  email: string,
  timeMode: 'random' | 'custom',
  customTime: string
): RepoInfo {
  const contributions: Array<{ date: string; count: number; time: string }> = [];

  for (let w = 0; w < grid.length; w++) {
    for (let d = 0; d < grid[w].length; d++) {
      if (grid[w][d] > 0) {
        let time: string;

        if (timeMode === 'random') {
          // 生成隨機時間 (00:00:00 - 23:59:59)
          const hour = Math.floor(Math.random() * 24);
          const minute = Math.floor(Math.random() * 60);
          const second = Math.floor(Math.random() * 60);
          time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
        } else {
          time = customTime;
        }

        contributions.push({
          date: formatISODate(dates[w][d]),
          count: grid[w][d] / 4,
          time
        });
      }
    }
  }

  return {
    repoName,
    user,
    email,
    total: contributions.length,
    contributions
  };
}

function renderToGrid(args: RenderArgs) {
  const {
    text,
    commitTimes,
    xOffsetWeeks,
    yOffsetDays,
    scale,
    spacing,
    invert,
    noise,
    year,
    dates,
  } = args;

  const weeks = dates.length;
  const grid = makeEmptyGrid(weeks, 7);
  const bmp = rasterizeText5x7(text, spacing);

  const H = bmp.length;
  const W = H ? bmp[0].length : 0;

  if (invert) {
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if (!inYear(dates[w][d], year)) continue;
        // invert: grid color level
        grid[w][d] = commitTimes;
      }
    }
  }

  for (let by = 0; by < H; by++) {
    for (let bx = 0; bx < W; bx++) {
      const on = bmp[by][bx] === 1;
      const value = invert ? (on ? 0 : 1) : on ? 1 : 0;

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const day = yOffsetDays + by * scale + sy;
          const week = xOffsetWeeks + bx * scale + sx;

          if (week < 0 || week >= weeks || day < 0 || day >= 7) continue;

          if (!inYear(dates[week][day], year)) continue;

          let level = 0;
          // grid color level
          if (value === 1) level = commitTimes;
          else if (noise > 0 && Math.random() < noise) level = 1;

          grid[week][day] = clamp(level, 0, 4);
        }
      }
    }
  }

  if (noise > 0) {
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if (!inYear(dates[w][d], year)) continue;

        // Skip text area
        const isInTextArea =
          w >= xOffsetWeeks &&
          w < xOffsetWeeks + W * scale &&
          d >= yOffsetDays &&
          d < yOffsetDays + H * scale;

        if (!isInTextArea && Math.random() < noise) {
          grid[w][d] = invert ? Math.max(0, commitTimes - 1) : 1;
        }
      }
    }
  }

  return grid;
}

function Cell({
  color,
  title,
  dim,
}: {
  color: string;
  title: string;
  dim: boolean;
}) {
  return (
    <div
      className="h-3 w-3 rounded-[3px] border border-black/5"
      style={{
        backgroundColor: color,
        opacity: dim ? 0.35 : 1,
      }}
      title={title}
    />
  );
}

function ContributionsChart({
  grid,
  dates,
  year,
  palette,
}: {
  grid: number[][];
  dates: Date[][];
  year: number;
  palette: typeof DEFAULT_PALETTE;
}) {
  return (
    <div className="inline-flex gap-[3px] rounded-lg bg-[#0d1117] p-4 shadow-sm border border-[#30363d]/50">
      {grid.map((col, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {col.map((level, d) => {
            const dt = dates[w][d];
            const dim = !inYear(dt, year);
            return (
              <Cell
                key={d}
                color={palette.colors[level]}
                dim={dim}
                title={`${formatISODate(dt)} | level=${level}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** ---------------- App ---------------- */
export default function App() {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(nowYear);
  const [weekStart, setWeekStart] = useState<WeekStart>("sun");

  const [text, setText] = useState("AB12");
  const [repoName, setRepoName] = useState("my-contributions-repo");
  const [user, setUser] = useState("username");
  const [email, setEmail] = useState("user@example.com");
  const [timeMode, setTimeMode] = useState<'random' | 'custom'>('random');
  const [customTime, setCustomTime] = useState("12:00:00");
  const [commitTimes, _setCommitTimes] = useState(4); // commit times per day
  const [spacing, setSpacing] = useState(1);
  const [xOffsetWeeks, setXOffsetWeeks] = useState(1);
  const [yOffsetDays, setYOffsetDays] = useState(0);
  const [invert, setInvert] = useState(false);
  const [noise, _setNoise] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const dateGrid = useMemo(() => buildYearDateGrid(year, weekStart), [year, weekStart]);

  const grid = useMemo(() => {
    return renderToGrid({
      text,
      commitTimes,
      scale: 1,
      spacing,
      xOffsetWeeks,
      yOffsetDays,
      invert,
      noise,
      year,
      dates: dateGrid.dates,
    });
  }, [text, commitTimes, spacing, xOffsetWeeks, yOffsetDays, invert, noise, year, dateGrid.dates]);

  const textWidth = useMemo(() => {
    const chars = (text || "").length;
    if (chars === 0) return 0;
    const charWidth = 5;
    return chars * (charWidth + spacing) - spacing;
  }, [text, spacing]);

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    const totalWeeks = dateGrid.weeks;
    switch (align) {
      case 'left':
        setXOffsetWeeks(1);
        break;
      case 'center':
        setXOffsetWeeks(Math.floor((totalWeeks - textWidth) / 2));
        break;
      case 'right':
        setXOffsetWeeks(totalWeeks - textWidth - 1);
        break;
    }
  };

  const handleExportJSON = async () => {
    const contributions: Array<{ date: string; count: number; time: string }> = [];

    for (let w = 0; w < grid.length; w++) {
      for (let d = 0; d < grid[w].length; d++) {
        if (grid[w][d] > 0) {
          let time: string;

          if (timeMode === 'random') {
            const hour = Math.floor(Math.random() * 24);
            const minute = Math.floor(Math.random() * 60);
            const second = Math.floor(Math.random() * 60);
            time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
          } else {
            time = customTime;
          }

          contributions.push({
            date: formatISODate(dateGrid.dates[w][d]),
            count: grid[w][d],
            time
          });
        }
      }
    }

    setIsGenerating(true);
    try {
      const blob = await generateRepo({
        repoName,
        user,
        email,
        total: contributions.length,
        contributions
      });
      
      // 創建下載連結
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repoName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Repository generated successfully!\n\nDownloading ${repoName}.zip...`);
    } catch (error) {
      alert(`❌ Failed to generate repository:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error generating repository:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">GitHub Contributions Chart Generator</h1>
          <p className="mt-2 text-sm text-[#8b949e]">
            Year: {year} | Week Start: {weekStart.toUpperCase()} | Grid Start: {formatISODate(dateGrid.gridStart)} | Weeks: {dateGrid.weeks}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          {/* Control Panel */}
          <Card className="bg-[#161b22] border-[#30363d]">
            <CardHeader>
              <CardTitle className="text-white">Control Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="chart" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="repository">Repository</TabsTrigger>
                  <TabsTrigger value="chart">Chart Settings</TabsTrigger>
                </TabsList>

                {/* Repository Info Tab */}
                <TabsContent value="repository" className="space-y-4 mt-4">
                  {/* Repo Name Input */}
                  <div className="space-y-2">
                    <Label htmlFor="repoName">Repository Name</Label>
                    <Input
                      id="repoName"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="my-contributions-repo"
                    />
                  </div>

                  {/* User and Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="user">User</Label>
                      <Input
                        id="user"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>

                  {/* Time Setting */}
                  <div className="space-y-2">
                    <Label htmlFor="timeMode">Commit Time</Label>
                    <Select value={timeMode} onValueChange={(value) => setTimeMode(value as 'random' | 'custom')}>
                      <SelectTrigger id="timeMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">Random Time</SelectItem>
                        <SelectItem value="custom">Custom Time</SelectItem>
                      </SelectContent>
                    </Select>
                    {timeMode === 'custom' && (
                      <div className="pt-2">
                        <Input
                          id="customTime"
                          type="time"
                          step="1"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          placeholder="12:00:00"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Chart Settings Tab */}
                <TabsContent value="chart" className="space-y-4 mt-4">
                  {/* Year and Week Start */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value || `${nowYear}`, 10))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekStart">Week Start</Label>
                      <Select value={weekStart} onValueChange={(value) => setWeekStart(value as WeekStart)}>
                        <SelectTrigger id="weekStart">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sun">Sunday</SelectItem>
                          <SelectItem value="mon">Monday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Text Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="text">Content</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors cursor-pointer">
                              Supported Characters?
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md bg-[#161b22] border-[#30363d] text-[#e6edf3] p-3">
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Supported Characters:</p>
                              <div className="text-xs space-y-1">
                                <p><span className="text-[#8b949e]">Uppercase:</span> A-Z</p>
                                <p><span className="text-[#8b949e]">Lowercase:</span> a-z</p>
                                <p><span className="text-[#8b949e]">Numbers:</span> 0-9</p>
                                <p><span className="text-[#8b949e]">Symbols:</span> {Object.keys(FONT_5X7).filter(k => !/^[a-zA-Z0-9]$/.test(k)).join(' ')}</p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="AB12"
                    />
                  </div>

                  {/* Spacing */}
                  <div className="space-y-2">
                    <Label htmlFor="spacing">Spacing: {spacing}</Label>
                    <Slider
                      id="spacing"
                      min={0}
                      max={5}
                      step={1}
                      value={[spacing]}
                      onValueChange={(value) => setSpacing(value[0])}
                    />
                  </div>

                  {/* Horizontal Alignment */}
                  <div className="space-y-2">
                    <Label>Horizontal Alignment</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAlign('left')}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[#e6edf3] bg-[#21262d] border border-[#30363d] rounded-md hover:bg-[#30363d] transition-colors"
                      >
                        Left
                      </button>
                      <button
                        onClick={() => handleAlign('center')}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[#e6edf3] bg-[#21262d] border border-[#30363d] rounded-md hover:bg-[#30363d] transition-colors"
                      >
                        Center
                      </button>
                      <button
                        onClick={() => handleAlign('right')}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[#e6edf3] bg-[#21262d] border border-[#30363d] rounded-md hover:bg-[#30363d] transition-colors"
                      >
                        Right
                      </button>
                    </div>
                  </div>

                  {/* X/Y Offset */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="xOffset">X Offset (weeks)</Label>
                      <Input
                        id="xOffset"
                        type="number"
                        value={xOffsetWeeks}
                        onChange={(e) => setXOffsetWeeks(parseInt(e.target.value || "0", 10))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yOffset">Y Offset (days)</Label>
                      <Input
                        id="yOffset"
                        type="number"
                        value={yOffsetDays}
                        onChange={(e) => setYOffsetDays(parseInt(e.target.value || "0", 10))}
                      />
                    </div>
                  </div>

                  {/* Invert Option */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="invert"
                      checked={invert}
                      onCheckedChange={(checked) => setInvert(checked as boolean)}
                    />
                    <Label htmlFor="invert" className="font-normal cursor-pointer">
                      Invert
                    </Label>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Export Button */}
              <div className="pt-4 border-t border-[#30363d]">
                <button
                  onClick={handleExportJSON}
                  disabled={isGenerating}
                  className="w-full px-4 py-3 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#8b949e] disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size="sm" className="text-white" />
                      Generating Repository...(may take 1-5 mins)
                    </span>
                  ) : (
                    'Generate Repository'
                  )}
                </button>
                <p className="mt-2 text-xs text-[#8b949e] text-center">
                  Total contributions: {grid.flat().filter(v => v > 0).length}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview Area */}
          <Card className="flex items-center justify-center bg-[#161b22] border-[#30363d]">
            <CardContent className="p-8">
              <ContributionsChart
                grid={grid}
                dates={dateGrid.dates}
                year={year}
                palette={DEFAULT_PALETTE}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
