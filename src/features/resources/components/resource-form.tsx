'use client'

import React, { useState, useActionState, useTransition } from 'react'
import Link from 'next/link'
import {
  createResourceAction,
  updateResourceAction,
  deleteResourceAction,
  type ResourceActionState,
  type DepartmentWithRoles,
  type ResourceWithDetails,
} from '@/features/resources/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  User,
  MapPin,
  Camera,
  Car,
  Package,
  Sparkles,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Coins,
  ShieldAlert,
  Trash2,
  Hospital,
  Lock,
  RotateCcw,
  PawPrint,
  Clapperboard,
} from 'lucide-react'
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal'
import type { ResourceType } from '@/types/database'

interface ResourceFormProps {
  projectId: string
  projectCurrency?: string
  departments: DepartmentWithRoles[]
  initialResource?: ResourceWithDetails | null
  /** Scenes this entry is tagged in via the breakdown */
  sceneUsage?: Array<{ id: string; scene_number: string; heading: string | null }>
  /** Characters this person plays */
  playing?: string[]
}

const RESOURCE_TYPES: Array<{
  type: ResourceType
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}> = [
  { type: 'PERSON', label: 'Cast & Crew', icon: User, desc: 'Actors, Director, DOP, technicians' },
  { type: 'LOCATION', label: 'Location', icon: MapPin, desc: 'Sets, studios, exterior locations' },
  { type: 'EQUIPMENT', label: 'Equipment', icon: Camera, desc: 'Camera, lenses, sound, lighting packages' },
  { type: 'VEHICLE', label: 'Vehicle', icon: Car, desc: 'Picture cars, grip trucks, honey wagons' },
  { type: 'PROP', label: 'Prop / Art', icon: Package, desc: 'Hero props, weapons, vehicles, set dressing' },
  { type: 'ANIMAL', label: 'Animal', icon: PawPrint, desc: 'Picture animals and their wranglers' },
  { type: 'OTHER', label: 'Other Asset', icon: Sparkles, desc: 'Animals, SFX rigs, specialized services' },
]

export function ResourceForm({
  projectId,
  projectCurrency = 'USD',
  departments,
  initialResource,
  sceneUsage = [],
  playing = [],
}: ResourceFormProps) {
  const isEditing = Boolean(initialResource?.id)

  const [selectedType, setSelectedType] = useState<ResourceType>(
    initialResource?.resource_type || 'PERSON'
  )

  // Find initial department & role
  const initialPrimaryRole = initialResource?.resource_roles?.[0]?.role
  const [selectedDeptId, setSelectedDeptId] = useState<string>(() => {
    if (initialPrimaryRole?.department?.id) return initialPrimaryRole.department.id
    return departments[0]?.id || ''
  })

  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    initialPrimaryRole?.id || ''
  )

  // Form actions
  const createActionWithProject = createResourceAction.bind(null, projectId)
  const updateActionWithIds =
    isEditing && initialResource
      ? updateResourceAction.bind(null, initialResource.id, projectId)
      : createActionWithProject

  const [state, formAction, isPending] = useActionState<ResourceActionState, FormData>(
    updateActionWithIds,
    {}
  )

  // Accidental deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeletePending, startDeleteTransition] = useTransition()

  const handleDeleteResource = () => {
    if (!initialResource) return
    startDeleteTransition(async () => {
      await deleteResourceAction(initialResource.id, projectId)
    })
  }

  // Filter roles by selected department
  const currentDept = departments.find((d) => d.id === selectedDeptId)
  const availableRoles = currentDept?.roles || []

  // Rate & location data
  const rate = initialResource?.resource_rates?.[0]
  const loc = initialResource?.location_details?.[0]

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Link
          href={`/projects/${projectId}/resources`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2 transition-colors"
        >
          ← Back to Resource Directory
        </Link>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {isEditing && initialResource ? `Edit ${initialResource.name}` : 'Add Production Resource'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Catalog cast, crew members, filming locations, and rental equipment with rates and logistics.
        </p>
      </div>

      <Card className="border-border bg-card/60 shadow-xl">
        <form action={formAction}>
          <CardContent className="space-y-8 pt-6">
            {state?.error && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <span>{state.error}</span>
              </div>
            )}

            {/* Resource Type Selector */}
            {!isEditing ? (
              <div className="space-y-3">
                <Label className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                  1. Select Resource Category
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {RESOURCE_TYPES.map((t) => {
                    const Icon = t.icon
                    const isSelected = selectedType === t.type
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setSelectedType(t.type)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                            : 'border-border bg-background/60 hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <Icon
                            className={`size-5 ${
                              isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
                            }`}
                          />
                          {isSelected && (
                            <span className="size-2 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <div>
                          <div
                            className={`text-sm font-semibold ${
                              isSelected ? 'text-foreground' : 'text-foreground'
                            }`}
                          >
                            {t.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {t.desc}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <input type="hidden" name="resourceType" value={selectedType} />
              </div>
            ) : (
              <input type="hidden" name="resourceType" value={selectedType} />
            )}

            {/* Core Identity */}
            <div className="space-y-4 pt-2 border-t border-border/80">
              <Label className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                2. Resource Details
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">
                    {selectedType === 'PERSON'
                      ? 'Full Name *'
                      : selectedType === 'LOCATION'
                      ? 'Location Name *'
                      : 'Asset / Item Name *'}
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={initialResource?.name || ''}
                    placeholder={
                      selectedType === 'PERSON'
                        ? 'e.g. Yash Patel'
                        : selectedType === 'LOCATION'
                        ? 'e.g. Royal Palace Courtyard'
                        : 'e.g. ARRI Alexa 35 Camera Package'
                    }
                    required
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm font-medium text-foreground">
                    {selectedType === 'PERSON'
                      ? 'Nickname / Call Name (optional)'
                      : 'Short Name / Call Code'}
                  </Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    defaultValue={initialResource?.display_name || ''}
                    placeholder={
                      selectedType === 'PERSON' ? 'e.g. Anil — characters are cast in Cast & Crew → Characters' : 'e.g. STAGE-4'
                    }
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                  />
                </div>
              </div>

              {/* Person-Specific: Department & Role */}
              {selectedType === 'PERSON' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="departmentSelect" className="text-sm font-medium text-foreground">
                      Department
                    </Label>
                    <select
                      id="departmentSelect"
                      value={selectedDeptId}
                      onChange={(e) => {
                        setSelectedDeptId(e.target.value)
                        const dept = departments.find((d) => d.id === e.target.value)
                        if (dept && dept.roles[0]) {
                          setSelectedRoleId(dept.roles[0].id)
                        } else {
                          setSelectedRoleId('')
                        }
                      }}
                      className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.code ? `(${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="roleId" className="text-sm font-medium text-foreground">
                      Role / Position
                    </Label>
                    <select
                      id="roleId"
                      name="roleId"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      {availableRoles.length > 0 ? (
                        availableRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No roles in department</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" /> Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={initialResource?.email || ''}
                    placeholder="name@production.com"
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" /> Phone / Mobile (For Call Sheet SMS)
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={initialResource?.phone || ''}
                    placeholder="+91 98765 43210 or +1 (555) 019-2834"
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="notes" className="text-sm font-medium text-foreground">
                  Notes, Dietary Restrictions & Special Instructions
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={initialResource?.notes || ''}
                  placeholder="e.g. Vegetarian meal, allergic to dust, requires pickup at 05:30 AM..."
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            {/* Location Intelligence (if LOCATION) */}
            {selectedType === 'LOCATION' && (
              <div className="space-y-4 pt-4 border-t border-border/80">
                <Label className="text-xs font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-semibold flex items-center gap-2">
                  <MapPin className="size-4" /> 3. Location Intelligence & Safety Logistics
                </Label>

                <div className="space-y-2">
                  <Label htmlFor="addressLine1" className="text-sm font-medium text-foreground">
                    Street Address
                  </Label>
                  <Input
                    id="addressLine1"
                    name="addressLine1"
                    defaultValue={loc?.address_line1 || ''}
                    placeholder="e.g. Film City Complex, Gate No. 2"
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs font-medium text-subtle-foreground">
                      City
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      defaultValue={loc?.city || ''}
                      placeholder="Mumbai / Atlanta"
                      className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stateProvince" className="text-xs font-medium text-subtle-foreground">
                      State / Province
                    </Label>
                    <Input
                      id="stateProvince"
                      name="stateProvince"
                      defaultValue={loc?.state_province || ''}
                      placeholder="MH / GA"
                      className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode" className="text-xs font-medium text-subtle-foreground">
                      Postal / ZIP Code
                    </Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      defaultValue={loc?.postal_code || ''}
                      placeholder="400065"
                      className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="nearestHospital" className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                      <Hospital className="size-3.5" /> Nearest Emergency Hospital (Call Sheet Standard)
                    </Label>
                    <Input
                      id="nearestHospital"
                      name="nearestHospital"
                      defaultValue={loc?.nearest_hospital || ''}
                      placeholder="e.g. Kokilaben Dhirubhai Ambani Hospital"
                      className="bg-background border-red-950/60 focus-visible:ring-red-500 text-foreground h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nearestHospitalKm" className="text-sm font-medium text-subtle-foreground">
                      Hospital Distance (Km)
                    </Label>
                    <Input
                      id="nearestHospitalKm"
                      name="nearestHospitalKm"
                      type="number"
                      step="0.1"
                      defaultValue={loc?.nearest_hospital_km || ''}
                      placeholder="e.g. 4.5"
                      className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="parkingNotes" className="text-sm font-medium text-foreground">
                    Crew Parking & Basecamp Notes
                  </Label>
                  <textarea
                    id="parkingNotes"
                    name="parkingNotes"
                    rows={2}
                    defaultValue={loc?.parking_notes || ''}
                    placeholder="Crew park in Lot C. Equipment trucks load in through Bay 1..."
                    className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Budget & Rate Engine */}
            <div className="space-y-4 pt-4 border-t border-border/80">
              <Label className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <Coins className="size-4" /> {selectedType === 'LOCATION' ? '4' : '3'}. Budget Rate & Estimated Shoot Days
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateType" className="text-xs font-medium text-subtle-foreground">
                    Rate Type
                  </Label>
                  <select
                    id="rateType"
                    name="rateType"
                    defaultValue={rate?.rate_type || 'DAILY'}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <option value="DAILY">Daily Rate</option>
                    <option value="HOURLY">Hourly Rate</option>
                    <option value="WEEKLY">Weekly Rate</option>
                    <option value="FLAT">Flat / Buyout</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateAmount" className="text-xs font-medium text-subtle-foreground">
                    Rate Amount ({projectCurrency})
                  </Label>
                  <Input
                    id="rateAmount"
                    name="rateAmount"
                    type="number"
                    step="0.01"
                    defaultValue={rate?.rate_amount !== undefined && rate?.rate_amount !== null ? rate.rate_amount : ''}
                    placeholder="e.g. 50000"
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedDays" className="text-xs font-medium text-subtle-foreground">
                    Est. Days on Production
                  </Label>
                  <Input
                    id="estimatedDays"
                    name="estimatedDays"
                    type="number"
                    step="0.5"
                    defaultValue={rate?.estimated_days !== undefined && rate?.estimated_days !== null ? rate.estimated_days : ''}
                    placeholder="e.g. 24"
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-xs font-medium text-subtle-foreground">
                    Currency
                  </Label>
                  <Input
                    id="currency"
                    name="currency"
                    defaultValue={rate?.currency || projectCurrency}
                    readOnly
                    className="bg-background/60 border-border text-muted-foreground h-10 font-mono"
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/80 pt-4 pb-4 flex items-center justify-between">
            <Link href={`/projects/${projectId}/resources`}>
              <Button type="button" variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6 shadow-lg shadow-amber-500/15 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving Resource...
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add to Production Directory'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Danger Zone: Remove Resource */}
      {isEditing && initialResource && (
        <>
          {selectedType === 'PERSON' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {playing.length ? `Plays ${playing.join(', ')}` : 'Not playing a character'}
                </CardTitle>
                <CardDescription className="text-xs">
                  Casting is managed in{' '}
                  <Link href={`/projects/${projectId}/resources?view=characters`} className="underline underline-offset-2">
                    Cast &amp; Crew → Characters
                  </Link>
                  . Whoever plays a character is booked for every scene that character is in.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clapperboard className="size-4 text-amber-600 dark:text-amber-400" />
                Appears in {sceneUsage.length} scene{sceneUsage.length === 1 ? '' : 's'}
              </CardTitle>
              <CardDescription className="text-xs">
                Tagged from the scene breakdown. Add or remove it there; renaming it here renames it in every scene.
              </CardDescription>
            </CardHeader>
            {sceneUsage.length > 0 && (
              <CardContent className="flex flex-wrap gap-2">
                {sceneUsage.map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/projects/${projectId}/breakdown?scene=${sc.id}`}
                    className="px-2 py-1 rounded-md border border-border bg-muted text-xs font-mono hover:border-amber-500/50"
                    title={sc.heading || undefined}
                  >
                    Sc {sc.scene_number}
                  </Link>
                ))}
              </CardContent>
            )}
          </Card>

          <Card className="border-red-900/40 bg-red-950/15">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs font-mono uppercase font-semibold">
                <ShieldAlert className="size-4" /> Danger Zone
              </div>
              <CardTitle className="text-base text-red-700 dark:text-red-300">Remove Resource</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Permanently remove this resource. It will also be removed from every scene breakdown, shoot-day booking, and call sheet it appears in.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0 pb-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                className="cursor-pointer text-xs"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Remove from Production
              </Button>
            </CardFooter>
          </Card>

          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteResource}
            title={`Remove "${initialResource.name}"`}
            description={
              sceneUsage.length > 0
                ? playing.length
                  ? `${initialResource.name} plays ${playing.join(', ')} in ${sceneUsage.length} scene${sceneUsage.length === 1 ? '' : 's'}. Removing them leaves those characters in the script but not cast, and removes their bookings and call-sheet entries.`
                  : `This entry is tagged in ${sceneUsage.length} scene${sceneUsage.length === 1 ? '' : 's'} (${sceneUsage
                      .slice(0, 6)
                      .map((sc) => sc.scene_number)
                      .join(', ')}${sceneUsage.length > 6 ? '…' : ''}). Removing it also removes it from those scenes' breakdowns, shoot-day bookings, and call sheets.`
                : 'Permanently remove this resource from the production directory. It is not tagged in any scene.'
            }
            itemName={initialResource.name}
            itemType="resource"
            isPending={isDeletePending}
          />
        </>
      )}
    </div>
  )
}
