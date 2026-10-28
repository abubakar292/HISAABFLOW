import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, orderBy, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, TrendingUp, Search, Plus, ChevronRight, X, Edit2, Trash2, AlertTriangle, MessageCircle, Filter } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { getWhatsAppKhataUrl } from '../config/shopConfig';

export default function KhataPage() {
  const { user, currentShopId, shopProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { success, error } = useToast();

  // Form State for Add
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'receivable' | 'payable'>('receivable');
  const [notes, setNotes] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const isAddingCustomerRef = useRef(false);

  // Edit Customer State
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState<'receivable' | 'payable'>('receivable');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const isSavingEditRef = useRef(false);

  // Delete Customer State
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    if (user && currentShopId) {
      fetchCustomers();
    } else {
      setCustomers([]);
      setLoading(false);
    }
  }, [user, currentShopId]);

  const fetchCustomers = async () => {
    if (!user || !currentShopId) return;
    setLoading(true);
    try {
      const custSnap = await getDocs(collection(db, 'khata'));
      const cust: any[] = [];
      custSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (isDocForShop(data, currentShopId)) {
          cust.push({ id: docSnap.id, ...data });
        }
      });
      // Sort client-side by createdAt descending
      cust.sort((a, b) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0).getTime());
        const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0).getTime());
        return db - da;
      });
      setCustomers(cust);
    } catch (e: any) {
      console.error(e);
      error(e.message || 'Error fetching customers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return error('Please sign in to add customers');
    if (!name || !type || isAddingCustomerRef.current || isAddingCustomer) return;
    
    isAddingCustomerRef.current = true;
    setIsAddingCustomer(true);
    try {
      await addDoc(collection(db, 'khata'), {
        shopId: currentShopId,
        userId: user.uid,
        userEmail: (user.email || '').toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        type,
        notes: notes.trim(),
        totalBalance: 0,
        createdAt: serverTimestamp()
      });
      setShowAddCustomer(false);
      setName(''); setPhone(''); setNotes('');
      success('Customer added to Khata');
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error adding customer');
    } finally {
      setIsAddingCustomer(false);
      isAddingCustomerRef.current = false;
    }
  };

  const handleOpenEdit = (customer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomerToEdit(customer);
    setEditName(customer.name || '');
    setEditPhone(customer.phone || '');
    setEditType(customer.type || 'receivable');
    setEditNotes(customer.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToEdit || !editName || isSavingEditRef.current || isSavingEdit) return;

    isSavingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      const custRef = doc(db, 'khata', customerToEdit.id);
      await updateDoc(custRef, {
        name: editName.trim(),
        phone: editPhone.trim(),
        type: editType,
        notes: editNotes.trim(),
        updatedAt: serverTimestamp()
      });

      // Also update customerName across their transactions
      try {
        const txQuery = query(collection(db, 'khataTransactions'), where('khataId', '==', customerToEdit.id));
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          const batch = writeBatch(db);
          txSnap.forEach(tDoc => {
            batch.update(doc(db, 'khataTransactions', tDoc.id), { customerName: editName.trim() });
          });
          await batch.commit();
        }
      } catch (txErr) {
        console.error('Error updating customer name in transactions', txErr);
      }

      success('Customer updated successfully');
      setCustomerToEdit(null);
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error updating customer');
    } finally {
      setIsSavingEdit(false);
      isSavingEditRef.current = false;
    }
  };

  const handleOpenDelete = (customer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomerToDelete(customer);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete || isDeletingRef.current || isDeleting) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      // 1. Delete all transactions associated with this customer
      const txQuery = query(collection(db, 'khataTransactions'), where('khataId', '==', customerToDelete.id));
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        const batch = writeBatch(db);
        txSnap.forEach(tDoc => {
          batch.delete(doc(db, 'khataTransactions', tDoc.id));
        });
        await batch.commit();
      }

      // 2. Delete customer document
      await deleteDoc(doc(db, 'khata', customerToDelete.id));

      success(`Customer "${customerToDelete.name}" and ledger deleted`);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error deleting customer');
    } finally {
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    return c.type === activeTab && matchesSearch;
  });

  const totalReceivable = customers.filter(c => c.type === 'receivable').reduce((s, c) => s + (c.totalBalance || 0), 0);
  const receivableCount = customers.filter(c => c.type === 'receivable').length;
  const totalPayable = customers.filter(c => c.type === 'payable').reduce((s, c) => s + (c.totalBalance || 0), 0);
  const payableCount = customers.filter(c => c.type === 'payable').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* TOP SUMMARY TABS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        {/* Tab 1: Receivable */}
        <button
          onClick={() => setActiveTab('receivable')}
          className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            activeTab === 'receivable'
              ? 'border-[#522D60] bg-[#522D60] text-white shadow-md'
              : 'border-gray-100 bg-white hover:border-[#522D60]/30 shadow-card'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-1.5 rounded-lg ${activeTab === 'receivable' ? 'bg-white/20' : 'bg-purple-50'}`}>
              <TrendingDown className={`w-4 h-4 ${activeTab === 'receivable' ? 'text-white' : 'text-[#522D60]'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Receivable</span>
          </div>
          <p className={`text-xl sm:text-2xl font-black ${activeTab === 'receivable' ? 'text-white' : 'text-gray-900'}`}>
            Rs. {totalReceivable.toLocaleString()}
          </p>
          <p className={`text-[11px] mt-1 font-medium ${activeTab === 'receivable' ? 'text-white/80' : 'text-gray-400'}`}>
            {receivableCount} customers owe you
          </p>
        </button>

        {/* Tab 2: Payable */}
        <button
          onClick={() => setActiveTab('payable')}
          className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            activeTab === 'payable'
              ? 'border-[#522D60] bg-[#522D60] text-white shadow-md'
              : 'border-gray-100 bg-white hover:border-[#522D60]/30 shadow-card'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-1.5 rounded-lg ${activeTab === 'payable' ? 'bg-white/20' : 'bg-gray-100'}`}>
              <TrendingUp className={`w-4 h-4 ${activeTab === 'payable' ? 'text-white' : 'text-gray-700'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Payable</span>
          </div>
          <p className={`text-xl sm:text-2xl font-black ${activeTab === 'payable' ? 'text-white' : 'text-gray-900'}`}>
            Rs. {totalPayable.toLocaleString()}
          </p>
          <p className={`text-[11px] mt-1 font-medium ${activeTab === 'payable' ? 'text-white/80' : 'text-gray-400'}`}>
            You owe {payableCount} suppliers
          </p>
        </button>
      </div>

      {/* SEARCH + ADD BUTTON */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] shadow-sm transition-all"
          />
        </div>
        <Button 
          variant="primary" 
          onClick={() => setShowAddCustomer(true)}
          className="bg-[#522D60] hover:bg-[#42244D] text-white px-4 py-2.5 text-xs sm:text-sm shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Account</span>
        </Button>
      </div>

      {/* CUSTOMER LIST */}
      <div className="space-y-2 pb-8">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No customers found.</p>
        ) : (
          filteredCustomers.map(customer => (
            <motion.div
              key={customer.id}
              whileHover={{ x: 2 }}
              onClick={() => navigate(`/khata/${customer.id}`)}
              className="bg-white rounded-xl p-4 shadow-card cursor-pointer hover:shadow-card-hover transition-all border border-gray-100 hover:border-[#522D60]/20 flex items-center gap-3 sm:gap-4 group"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                customer.type === 'receivable' ? 'bg-purple-100 text-[#522D60]' : 'bg-gray-100 text-gray-700'
              }`}>
                {customer.name?.[0]?.toUpperCase() || 'C'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
                <p className="text-xs text-gray-400 truncate">{customer.phone || 'No phone'}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-bold ${
                  customer.type === 'receivable' ? 'text-[#522D60]' : 'text-gray-800'
                }`}>
                  Rs. {(customer.totalBalance || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {customer.type === 'receivable' ? 'will give you' : 'you owe'}
                </p>
              </div>

              {/* Action Buttons: WhatsApp, Edit & Delete */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {customer.phone ? (
                  <a
                    href={getWhatsAppKhataUrl(customer.phone, customer.name, customer.totalBalance || 0, customer.type)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Send WhatsApp Reminder"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500/20" />
                    <span className="hidden sm:inline">Reminder</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(customer, e);
                    }}
                    title="Phone number missing — Click to add phone for 1-Click WhatsApp"
                    className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 text-xs font-medium rounded-lg border border-dashed border-slate-300 hover:border-emerald-300 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">+ Phone</span>
                  </button>
                )}

                <button
                  type="button"
                  title="Edit Customer"
                  onClick={(e) => handleOpenEdit(customer, e)}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Delete Customer"
                  onClick={(e) => handleOpenDelete(customer, e)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-gray-300 ml-0.5" />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ADD CUSTOMER MODAL */}
      <AnimatePresence>
        {showAddCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={() => setShowAddCustomer(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-lg font-bold">Add Customer</h3>
                <button onClick={() => setShowAddCustomer(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6">
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
                  <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value as any)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest"
                    >
                      <option value="receivable">Receivable (Will give you)</option>
                      <option value="payable">Payable (You owe them)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full" isLoading={isAddingCustomer} disabled={isAddingCustomer}>Save Customer</Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT CUSTOMER MODAL */}
      <Modal isOpen={!!customerToEdit} onClose={() => setCustomerToEdit(null)} title="Edit Customer" size="md">
        {customerToEdit && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Input label="Customer Name" required value={editName} onChange={e => setEditName(e.target.value)} />
            <Input label="Phone Number" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Type</label>
              <select
                value={editType}
                onChange={e => setEditType(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest"
              >
                <option value="receivable">Receivable (Will give you)</option>
                <option value="payable">Payable (You owe them)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Notes (Optional)</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" disabled={isSavingEdit} onClick={() => setCustomerToEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" isLoading={isSavingEdit} disabled={isSavingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      <Modal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} title="Delete Customer" size="sm">
        {customerToDelete && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-base">Delete {customerToDelete.name}?</h4>
              <p className="text-xs text-gray-500 mt-1">
                This will delete the customer and all associated Khata ledger transactions. Current balance: <span className="font-semibold text-gray-800">Rs. {(customerToDelete.totalBalance || 0).toLocaleString()}</span>. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setCustomerToDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" className="flex-1" onClick={handleConfirmDelete} isLoading={isDeleting} disabled={isDeleting}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

