"use client"

import React, { useState, useRef } from 'react'
import Papa from 'papaparse'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

// Form validation schema for multi-select
const plotConfigSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  xAxisLabel: z.string().min(1, 'X-axis label is required'),
  yAxisLabel: z.string().min(1, 'Y-axis label is required'),
  xAxisAttributes: z.array(z.string()).min(1, 'At least one X-axis attribute is required'),
  yAxisAttributes: z.array(z.string()).min(1, 'At least one Y-axis attribute is required'),
})

type PlotConfigForm = z.infer<typeof plotConfigSchema>

interface CSVData {
  [key: string]: string | number
}

interface ProcessedRow {
  [key: string]: string | number
}

interface XYCombination {
  xAttr: string
  yAttr: string
  lineKey: string
  lineName: string
  color: string
}

// Multi-Select Component
const MultiSelectField = ({ 
  options, 
  value, 
  onChange, 
  placeholder 
}: {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
}) => {
  const handleCheckboxChange = (option: string, checked: boolean) => {
    if (checked) {
      onChange([...value, option])
    } else {
      onChange(value.filter(item => item !== option))
    }
  }

  return (
    <div className="space-y-2">
      <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        ) : (
          options.map((option) => (
            <div key={option} className="flex items-center space-x-2 py-1">
              <Checkbox
                id={`${option}-checkbox`}
                checked={value.includes(option)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(option, checked as boolean)
                }
              />
              <Label 
                htmlFor={`${option}-checkbox`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {option}
              </Label>
            </div>
          ))
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v !== item))}
                className="ml-1 hover:text-primary/70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CSVVisualizer() {
  const [csvData, setCsvData] = useState<CSVData[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [plotConfig, setPlotConfig] = useState<PlotConfigForm | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const form = useForm<PlotConfigForm>({
    resolver: zodResolver(plotConfigSchema),
    defaultValues: {
      title: '',
      xAxisLabel: '',
      yAxisLabel: '',
      xAxisAttributes: [],
      yAxisAttributes: [],
    },
  })

  // Watch form values for real-time updates
  const watchedXAttributes = form.watch('xAxisAttributes')
  const watchedYAttributes = form.watch('yAxisAttributes')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error("Invalid file type. Please upload a CSV file.")
      return
    }

    setIsUploading(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error("Error parsing CSV file.")
          setIsUploading(false)
          return
        }

        const data = results.data as CSVData[]
        const columns = Object.keys(data[0] || {})
        
        setCsvData(data)
        setCsvColumns(columns)
        setIsUploading(false)
        
        // Reset form when new data is uploaded
        form.reset({
          title: '',
          xAxisLabel: '',
          yAxisLabel: '',
          xAxisAttributes: [],
          yAxisAttributes: [],
        })
        
        toast.success(`CSV uploaded successfully! Loaded ${data.length} rows with ${columns.length} columns.`)
      },
      error: () => {
        toast.error("Failed to upload the CSV file.")
        setIsUploading(false)
      }
    })
  }

  const onSubmit = (data: PlotConfigForm) => {
    // Validation for multi-select combinations
    if (data.xAxisAttributes.length === 0) {
      toast.error("Please select at least one X-axis attribute.")
      return
    }
    
    if (data.yAxisAttributes.length === 0) {
      toast.error("Please select at least one Y-axis attribute.")
      return
    }

    setPlotConfig(data)
    
    const totalLines = data.xAxisAttributes.length * data.yAxisAttributes.length
    toast.success(`Plot generated successfully! Created ${totalLines} lines from ${data.xAxisAttributes.length} X-axis and ${data.yAxisAttributes.length} Y-axis attributes.`)
  }

  // Generate all X-Y combinations with colors and labels
  const generateXYCombinations = (): XYCombination[] => {
    if (!plotConfig) return []

    const { xAxisAttributes, yAxisAttributes } = plotConfig
    const combinations: XYCombination[] = []
    
    // Extended color palette for multiple lines
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', 
      '#00ffff', '#ff0000', '#0000ff', '#ffff00', '#ff8000', '#8000ff',
      '#00ff80', '#ff0080', '#80ff00', '#0080ff', '#ff8080', '#80ff80',
      '#8080ff', '#ffff80', '#ff80ff', '#80ffff', '#c0c0c0', '#800000'
    ]

    let colorIndex = 0
    
    xAxisAttributes.forEach(xAttr => {
      yAxisAttributes.forEach(yAttr => {
        const lineKey = `${xAttr}_vs_${yAttr}`
        const lineName = `${yAttr} vs ${xAttr}`
        const color = colors[colorIndex % colors.length]
        
        combinations.push({
          xAttr,
          yAttr,
          lineKey,
          lineName,
          color
        })
        
        colorIndex++
      })
    })

    return combinations
  }

  // Process data for all X-Y combinations
  const processDataForPlot = (): ProcessedRow[] => {
    if (!plotConfig || csvData.length === 0) return []

    const combinations = generateXYCombinations()
    
    return csvData.map((row, index) => {
      const processedRow: ProcessedRow = {
        index: index // Add an index for consistent ordering
      }
      
      // Add all X attributes as potential axis values
      plotConfig.xAxisAttributes.forEach(xAttr => {
        processedRow[xAttr] = Number(row[xAttr]) || row[xAttr]
      })
      
      // Add all Y values for each X-Y combination
      combinations.forEach(combo => {
        processedRow[combo.lineKey] = Number(row[combo.yAttr]) || 0
      })
      
      return processedRow
    })
  }

  // Generate chart lines for all combinations
  const generateChartLines = () => {
    const combinations = generateXYCombinations()
    
    return combinations.map(combo => (
      <Line
        key={combo.lineKey}
        type="monotone"
        dataKey={combo.lineKey}
        stroke={combo.color}
        strokeWidth={2}
        dot={{ fill: combo.color, r: 3 }}
        name={combo.lineName}
        connectNulls={false}
      />
    ))
  }

  // Determine primary X-axis for chart display
  const getPrimaryXAxis = (): string => {
    if (!plotConfig || plotConfig.xAxisAttributes.length === 0) return 'index'
    
    // Use the first X attribute as primary axis, or index if multiple X attributes
    if (plotConfig.xAxisAttributes.length === 1) {
      return plotConfig.xAxisAttributes[0]
    }
    
    // For multiple X attributes, we'll use index and show a note
    return 'index'
  }

  const processedData = processDataForPlot()
  const primaryXAxis = getPrimaryXAxis()
  const combinations = generateXYCombinations()

  const exportToPNG = () => {
    if (!chartRef.current) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const svgElement = chartRef.current.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      const link = document.createElement('a')
      link.download = `${plotConfig?.title || 'chart'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">CSV Data Visualizer</h1>
        <p className="text-muted-foreground mt-2">Upload your CSV file and create multi-combination line charts</p>
      </div>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Dataset</CardTitle>
          <CardDescription>Select a CSV file to visualize your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                ref={fileInputRef}
                className="mt-1"
              />
            </div>
            {isUploading && <p className="text-sm text-muted-foreground">Uploading and parsing CSV...</p>}
            {csvData.length > 0 && (
              <p className="text-sm text-green-600">
                ✓ Successfully loaded {csvData.length} rows with columns: {csvColumns.join(', ')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plot Configuration Form */}
      {csvData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plot Configuration</CardTitle>
            <CardDescription>Configure your multi-combination chart settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plot Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter plot title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="xAxisLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X-axis Label</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter X-axis label" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="yAxisLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Y-axis Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Y-axis label" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="xAxisAttributes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X-axis Attributes</FormLabel>
                        <FormControl>
                          <MultiSelectField
                            options={csvColumns}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select columns for X-axis"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Selected: {watchedXAttributes.length} column(s)
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yAxisAttributes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Y-axis Attributes</FormLabel>
                        <FormControl>
                          <MultiSelectField
                            options={csvColumns}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select columns for Y-axis"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Selected: {watchedYAttributes.length} column(s)
                        </p>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Combination Preview */}
                {watchedXAttributes.length > 0 && watchedYAttributes.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      <strong>Chart Preview:</strong> {watchedXAttributes.length} × {watchedYAttributes.length} = {watchedXAttributes.length * watchedYAttributes.length} lines
                    </p>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p><strong>X-axis attributes:</strong> {watchedXAttributes.join(', ')}</p>
                      <p><strong>Y-axis attributes:</strong> {watchedYAttributes.join(', ')}</p>
                      <p><strong>Combinations:</strong></p>
                      <div className="ml-2 grid grid-cols-2 gap-1">
                        {watchedXAttributes.slice(0, 4).map(x => 
                          watchedYAttributes.slice(0, 3).map(y => (
                            <span key={`${x}-${y}`} className="text-xs">• {y} vs {x}</span>
                          ))
                        )}
                        {watchedXAttributes.length * watchedYAttributes.length > 12 && (
                          <span className="text-xs font-medium">... and {(watchedXAttributes.length * watchedYAttributes.length) - 12} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  Generate Multi-Combination Chart
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Chart Display */}
      {plotConfig && csvData.length > 0 && processedData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{plotConfig.title}</CardTitle>
              <CardDescription>
                Multi-combination line chart with {combinations.length} lines 
                ({plotConfig.xAxisAttributes.length} X-axis × {plotConfig.yAxisAttributes.length} Y-axis attributes)
              </CardDescription>
            </div>
            <Button onClick={exportToPNG} variant="outline">
              Export as PNG
            </Button>
          </CardHeader>
          <CardContent>
            {/* Chart Info */}
            {plotConfig.xAxisAttributes.length > 1 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Multiple X-axis attributes selected. Chart uses row index as X-axis. 
                  Each line represents a different X-Y combination.
                </p>
              </div>
            )}
            
            <div ref={chartRef} className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={primaryXAxis}
                    label={{ 
                      value: plotConfig.xAxisAttributes.length === 1 ? plotConfig.xAxisLabel : 'Row Index', 
                      position: 'insideBottom', 
                      offset: -10 
                    }}
                  />
                  <YAxis 
                    label={{ value: plotConfig.yAxisLabel, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => 
                      plotConfig.xAxisAttributes.length === 1 
                        ? `${plotConfig.xAxisLabel}: ${label}`
                        : `Row: ${label}`
                    }
                  />
                  <Legend />
                  {generateChartLines()}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Combination Summary */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm font-medium mb-2">Line Combinations ({combinations.length} total):</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                {combinations.map(combo => (
                  <div key={combo.lineKey} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: combo.color }}
                    ></div>
                    <span>{combo.lineName}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
