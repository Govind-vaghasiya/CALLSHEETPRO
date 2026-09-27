'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  User,
  MapPin,
  Camera,
  Car,
  Package,
  Plus,
  Search,
  Phone,
  Mail,
  Coins,
  Hospital,
  ChevronRight,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ResourceType } from '@/types/database'
import type { ResourceWithDetails } from '@/features/resources/actions'

interface ResourcesDirectoryProps {
  projectId: string
  projectCurrency?: string
  resources: ResourceWithDetails[]
  /** person id → characters they play */
  playingByPerson?: Record<string, string[]>
}

export function ResourcesDirectory({
  projectId,
  projectCurrency = 'USD',
  resources,
  playingByPerson = {},
}: ResourcesDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | ResourceType>('ALL')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL')

  // Calculate high-level summary metrics
  const stats = useMemo(() => {
    let castAndCrewCount = 0
    let locationsCount = 0
    let equipmentCount = 0
    let totalBudget = 0

    resources.forEach((r) => {
      if (r.resource_type === 'PERSON') castAndCrewCount++
      if (r.resource_type === 'LOCATION') locationsCount++
      if (r.resource_type === 'EQUIPMENT' || r.resource_type === 'VEHICLE' || r.resource_type === 'PROP') {
        equipmentCount++
      }

      const rate = r.resource_rates?.[0]
      if (rate?.rate_amount) {
        const days = rate.estimated_days || 1
        totalBudget += Number(rate.rate_amount) * Number(days)
      }
    })

    return {
      castAndCrewCount,
      locationsCount,
      equipmentCount,
      totalBudget,
      totalCount: resources.length,
    }
  }, [resources])

  // Extract list of unique departments
  const departmentList = useMemo(() => {
    const set = new Set<string>()
    resources.forEach((r) => {
      const deptName = r.resource_roles?.[0]?.role?.department?.name
      if (deptName) set.add(deptName)
    })
    return Array.from(set).sort()
  }, [resources])

  // Filter resources based on tab, search query, and department
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      // Type Tab Filter
      if (activeTab !== 'ALL' && r.resource_type !== activeTab) {
        return false
      }

      // Department Filter (for PERSON)
      if (selectedDeptFilter !== 'ALL') {
        const deptName = r.resource_roles?.[0]?.role?.department?.name
        if (deptName !== selectedDeptFilter) return false
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = r.name.toLowerCase().includes(q)
        const displayMatch = r.display_name?.toLowerCase().includes(q)
        const emailMatch = r.email?.toLowerCase().includes(q)
        const phoneMatch = r.phone?.toLowerCase().includes(q)
        const roleMatch = r.resource_roles?.[0]?.role?.name?.toLowerCase().includes(q)
        const deptMatch = r.resource_roles?.[0]?.role?.department?.name?.toLowerCase().includes(q)
        const locCityMatch = r.location_details?.[0]?.city?.toLowerCase().includes(q)
        const locAddressMatch = r.location_details?.[0]?.address_line1?.toLowerCase().includes(q)

        if (
          !nameMatch &&
          !displayMatch &&
          !emailMatch &&
          !phoneMatch &&
          !roleMatch &&
          !deptMatch &&
          !locCityMatch &&
          !locAddressMatch
        ) {
          return false
        }
      }

      return true
    })
  }, [resources, activeTab, selectedDeptFilter, searchQuery])

  // Format currency helper
  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: projectCurrency,
        maximumFractionDigits: 0,
      }).format(amount)
    } catch {
      return `${projectCurrency} ${amount.toLocaleString()}`
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner / Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-muted-foreground">Cast & Crew</span>
            <Users className="size-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {stats.castAndCrewCount}
          </div>
          <p className="text-[11px] text-faint mt-0.5">Attached production personnel</p>
        </Card>

        <Card className="border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-muted-foreground">Locations</span>
            <MapPin className="size-4 text-cyan-700 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {stats.locationsCount}
          </div>
          <p className="text-[11px] text-faint mt-0.5">Scouted & confirmed sets</p>
        </Card>

        <Card className="border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-muted-foreground">Gear & Vehicles</span>
            <Camera className="size-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {stats.equipmentCount}
          </div>
          <p className="text-[11px] text-faint mt-0.5">Packages, rigs & trucks</p>
        </Card>

        <Card className="border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-muted-foreground">Est. Resource Budget</span>
            <Coins className="size-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1 truncate">
            {formatCurrency(stats.totalBudget)}
          </div>
          <p className="text-[11px] text-faint mt-0.5">Total rate × estimated days</p>
        </Card>
      </div>

      {/* Action Bar & Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border sm:border-0 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            All Resources ({stats.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PERSON')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'PERSON'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <User className="size-3.5" /> Cast & Crew ({stats.castAndCrewCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LOCATION')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'LOCATION'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <MapPin className="size-3.5" /> Locations ({stats.locationsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EQUIPMENT')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'EQUIPMENT'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Camera className="size-3.5" /> Equipment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('VEHICLE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'VEHICLE'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Car className="size-3.5" /> Vehicles
          </button>
        </div>

        {/* Add Resource Button */}
        <Link href={`/projects/${projectId}/resources/new`}>
          <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4 shadow-lg shadow-amber-500/15 cursor-pointer text-xs h-10 w-full sm:w-auto">
            <Plus className="size-4 mr-1.5" /> Add Resource
          </Button>
        </Link>
      </div>

      {/* Search & Department Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, role, department, location address, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border text-foreground placeholder:text-faint h-10 text-xs focus-visible:ring-amber-500"
          />
        </div>

        {departmentList.length > 0 && activeTab !== 'LOCATION' && (
          <div className="w-full sm:w-60 shrink-0">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <option value="ALL">All Departments</option>
              {departmentList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Resources Grid View */}
      {filteredResources.length === 0 ? (
        <Card className="border-dashed border-border bg-background/40 p-12 text-center">
          <div className="size-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground mb-4">
            <Users className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No resources found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-6">
            {resources.length === 0
              ? 'Start building your production directory by adding cast members, key crew, locations, and camera packages.'
              : 'No resources match your current filter and search query.'}
          </p>
          <Link href={`/projects/${projectId}/resources/new`}>
            <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6 cursor-pointer text-xs">
              <Plus className="size-4 mr-1.5" /> Add First Resource
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
          {filteredResources.map((resource) => {
            const primaryRole = resource.resource_roles?.[0]?.role
            const dept = primaryRole?.department
            const rate = resource.resource_rates?.[0]
            const loc = resource.location_details?.[0]

            return (
              <Link
                key={resource.id}
                href={`/projects/${projectId}/resources/${resource.id}`}
                className="group block"
              >
                <Card className="border-border bg-card/60 hover:bg-card hover:border-border-strong transition-all shadow-lg overflow-hidden h-full flex flex-col justify-between">
                  <div className="p-4 space-y-3">
                    {/* Header: Icon, Type Badge & Role */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border"
                          style={{
                            backgroundColor: dept?.color ? `${dept.color}20` : '#27272a',
                            borderColor: dept?.color ? `${dept.color}50` : '#3f3f46',
                            color: dept?.color || '#fbbf24',
                          }}
                        >
                          {resource.resource_type === 'LOCATION' ? (
                            <MapPin className="size-4.5 text-cyan-700 dark:text-cyan-400" />
                          ) : resource.resource_type === 'EQUIPMENT' ? (
                            <Camera className="size-4.5 text-emerald-700 dark:text-emerald-400" />
                          ) : resource.resource_type === 'VEHICLE' ? (
                            <Car className="size-4.5 text-purple-700 dark:text-purple-400" />
                          ) : resource.resource_type === 'PROP' ? (
                            <Package className="size-4.5 text-pink-700 dark:text-pink-400" />
                          ) : (
                            resource.name.slice(0, 2).toUpperCase()
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                            {resource.name}
                          </h4>
                          {playingByPerson[resource.id]?.length ? (
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 truncate">
                              as {playingByPerson[resource.id].join(', ')}
                            </p>
                          ) : resource.display_name ? (
                            <p className="text-[11px] text-muted-foreground truncate">{resource.display_name}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {dept && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-border-strong text-subtle-foreground"
                          >
                            {dept.code || dept.name}
                          </Badge>
                        )}
                        <ChevronRight className="size-4 text-faint group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors" />
                      </div>
                    </div>

                    {/* Role / Type Description */}
                    {primaryRole && (
                      <div className="inline-block text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        {primaryRole.name}
                      </div>
                    )}

                    {/* Location Intelligence Snippet */}
                    {resource.resource_type === 'LOCATION' && loc && (
                      <div className="space-y-1 text-xs text-muted-foreground font-mono">
                        {loc.address_line1 && (
                          <div className="truncate text-subtle-foreground">
                            {loc.address_line1}
                            {loc.city ? `, ${loc.city}` : ''}
                          </div>
                        )}
                        {loc.nearest_hospital && (
                          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-[11px]">
                            <Hospital className="size-3 shrink-0" />
                            <span className="truncate">
                              Hospital: {loc.nearest_hospital}
                              {loc.nearest_hospital_km ? ` (${loc.nearest_hospital_km}km)` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Contact Details (For PERSON or LOCATION) */}
                    {(resource.phone || resource.email) && (
                      <div className="pt-1 space-y-1 text-xs text-muted-foreground">
                        {resource.phone && (
                          <div className="flex items-center gap-2 truncate">
                            <Phone className="size-3 text-faint shrink-0" />
                            <span>{resource.phone}</span>
                          </div>
                        )}
                        {resource.email && (
                          <div className="flex items-center gap-2 truncate">
                            <Mail className="size-3 text-faint shrink-0" />
                            <span className="truncate">{resource.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes preview */}
                    {resource.notes && (
                      <p className="text-[11px] text-faint italic line-clamp-1">
                        {resource.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Rate & Budget Calculation */}
                  <div className="border-t border-border/80 bg-background/40 px-4 py-2.5 flex items-center justify-between text-xs">
                    {rate?.rate_amount ? (
                      <div className="flex items-center gap-1.5 text-subtle-foreground font-mono">
                        <Coins className="size-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>
                          {rate.currency} {Number(rate.rate_amount).toLocaleString()}
                        </span>
                        <span className="text-faint text-[10px]">
                          / {rate.rate_type.toLowerCase()}
                        </span>
                        {rate.estimated_days && (
                          <span className="text-muted-foreground text-[10px]">
                            ({rate.estimated_days}d ={' '}
                            <strong className="text-amber-700 dark:text-amber-400 font-semibold">
                              {rate.currency}{' '}
                              {(Number(rate.rate_amount) * Number(rate.estimated_days)).toLocaleString()}
                            </strong>
                            )
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-faint italic">No rate assigned</span>
                    )}

                    <span className="text-[11px] font-mono text-faint group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      Edit →
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
