import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Forms';
import { Avatar } from '../components/ui/Avatar';
import { AddFosterModal } from '../components/fosters/AddFosterModal';
import {
  SearchIcon,
  PlusIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  LayoutGridIcon,
  ListIcon } from
'lucide-react';
import { motion } from 'framer-motion';
export function FostersList() {
  const { fosters, fostersLoading, placements } = useWhisker();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const filteredFosters = fosters.filter((foster) => {
    const searchStr =
    `${foster.first_name} ${foster.last_name} ${foster.email}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });
  const getActivePlacementsCount = (fosterId: string) => {
    return placements.filter(
      (p) => p.foster_parent_id === fosterId && p.placement_status === 'active'
    ).length;
  };
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Foster Network
          </h1>
          <p className="text-text-secondary">
            Manage foster homes and capacity.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          Add Foster
        </Button>
      </div>

      <Card className="p-4 bg-background/50 border-none shadow-none flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <Input
            placeholder="Search fosters by name or email..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          
        </div>
        <div className="flex items-center bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => setView('table')}
            className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            
            <ListIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            
            <LayoutGridIcon className="w-4 h-4" />
          </button>
        </div>
      </Card>

      {fostersLoading && fosters.length === 0 ?
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
          Loading fosters…
        </div> :
      view === 'grid' ?
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFosters.length === 0 ?
        <div className="col-span-full p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
              No fosters found matching your search.
            </div> :

        filteredFosters.map((foster, index) => {
          const activeCount = getActivePlacementsCount(foster.id);
          const isFull = activeCount >= foster.max_capacity;
          const capacityPercent = activeCount / foster.max_capacity * 100;
          return (
            <motion.div
              key={foster.id}
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: index * 0.05
              }}>
              
                  <Link to={`/fosters/${foster.id}`} className="block h-full">
                    <Card hoverLift className="h-full flex flex-col p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar
                      src={foster.photo_url}
                      name={`${foster.first_name} ${foster.last_name}`}
                      colorKey={foster.id}
                      type="person"
                      size="lg" />
                    
                        <div>
                          <h3 className="font-heading font-bold text-lg text-text-primary group-hover:text-primary transition-colors">
                            {foster.first_name} {foster.last_name}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[180px]">
                              {foster.address.split(',')[0]}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-6 flex-1">
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <PhoneIcon className="w-4 h-4" /> {foster.phone}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <MailIcon className="w-4 h-4" />{' '}
                          <span className="truncate">{foster.email}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-text-secondary">Capacity</span>
                          <span className="font-medium text-text-primary">
                            {activeCount} / {foster.max_capacity}
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                          <div
                        className={`h-2 rounded-full transition-all duration-500 ${isFull ? 'bg-status-urgent-text' : 'bg-[#3E7B52]'}`}
                        style={{
                          width: `${Math.min(100, capacityPercent)}%`
                        }} />
                      
                        </div>
                        <div className="mt-3 flex gap-1 flex-wrap">
                          {foster.preferred_species.map((s) =>
                      <span
                        key={s}
                        className="text-xs px-2 py-1 bg-accent text-secondary rounded-md font-medium">
                        
                              {s}
                            </span>
                      )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>);

        })
        }
        </div> :

      <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-background/50 text-sm font-medium text-text-secondary">
                  <th className="py-4 px-6 font-medium">Foster Parent</th>
                  <th className="py-4 px-6 font-medium">Contact</th>
                  <th className="py-4 px-6 font-medium">Location</th>
                  <th className="py-4 px-6 font-medium">Capacity</th>
                  <th className="py-4 px-6 font-medium">Preferences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFosters.length === 0 ?
              <tr>
                    <td
                  colSpan={5}
                  className="py-12 text-center text-text-secondary">
                  
                      No fosters found matching your search.
                    </td>
                  </tr> :

              filteredFosters.map((foster, index) => {
                const activeCount = getActivePlacementsCount(foster.id);
                const isFull = activeCount >= foster.max_capacity;
                const capacityPercent =
                activeCount / foster.max_capacity * 100;
                return (
                  <motion.tr
                    key={foster.id}
                    initial={{
                      opacity: 0,
                      y: 10
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      delay: index * 0.05
                    }}
                    className="hover:bg-[#FAFAF8] transition-colors group">
                    
                        <td className="py-4 px-6">
                          <Link
                        to={`/fosters/${foster.id}`}
                        className="flex items-center gap-4">
                        
                            <Avatar
                          src={foster.photo_url}
                          name={`${foster.first_name} ${foster.last_name}`}
                          colorKey={foster.id}
                          type="person" />
                        
                            <div>
                              <p className="font-medium text-text-primary group-hover:text-primary transition-colors">
                                {foster.first_name} {foster.last_name}
                              </p>
                              {!foster.active &&
                          <span className="text-xs text-status-urgent-text">
                                  Inactive
                                </span>
                          }
                            </div>
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-text-primary">
                            {foster.phone}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {foster.email}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-text-primary">
                            {foster.address.split(',')[0]}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-text-primary w-8">
                              {activeCount}/{foster.max_capacity}
                            </span>
                            <div className="w-16 bg-background rounded-full h-1.5 overflow-hidden">
                              <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${isFull ? 'bg-status-urgent-text' : 'bg-[#3E7B52]'}`}
                            style={{
                              width: `${Math.min(100, capacityPercent)}%`
                            }} />
                          
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-1 flex-wrap">
                            {foster.preferred_species.map((s) =>
                        <span
                          key={s}
                          className="text-xs px-2 py-1 bg-accent text-secondary rounded-md font-medium">
                          
                                {s}
                              </span>
                        )}
                          </div>
                        </td>
                      </motion.tr>);

              })
              }
              </tbody>
            </table>
          </div>
        </Card>
      }

      <AddFosterModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)} />
      
    </div>);

}