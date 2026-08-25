import { Phone, AlertTriangle, Hospital, MapPin, Clock, FileText, Heart, Ambulance } from "lucide-react";

interface EmergencyContact {
  name: string;
  number: string;
  available: string;
  description: string;
  icon: typeof Phone;
  priority: "critical" | "urgent" | "support";
}

export function EmergencySupportHub() {
  const emergencyContacts: EmergencyContact[] = [
    {
      name: "Emergency Services",
      number: "Emergency Line",
      available: "24/7",
      description: "Life-threatening emergencies, severe chest pain, difficulty breathing",
      icon: Ambulance,
      priority: "critical"
    },
    {
      name: "KMC-RI Hospital Emergency Line",
      number: "Emergency Hotline",
      available: "24/7",
      description: "Urgent dialysis-related issues, access site problems, severe symptoms",
      icon: Hospital,
      priority: "critical"
    },
    {
      name: "KMC-RI On-Call Nephrologist",
      number: "On-Call Line",
      available: "24/7",
      description: "Medical questions, medication concerns, treatment complications",
      icon: Phone,
      priority: "urgent"
    },
    {
      name: "KMC-RI Nurse Advice Line",
      number: "Nurse Hotline",
      available: "24/7",
      description: "General health questions, symptom guidance, non-urgent concerns",
      icon: Heart,
      priority: "support"
    },
  ];

  const emergencySigns = [
    "Chest pain or pressure",
    "Severe shortness of breath",
    "Sudden weakness or numbness",
    "Severe bleeding from access site",
    "Signs of infection (fever, redness, swelling)",
    "Severe headache or confusion",
    "Uncontrolled nausea or vomiting",
    "Rapid or irregular heartbeat"
  ];

  const nearestFacilities = [
    {
      name: "KMC-RI Hospital - Emergency Department",
      address: "KMC-RI Medical Campus, Main Building",
      distance: "On Campus",
      hasDialysis: true,
      phone: "Contact Hotline"
    },
    {
      name: "KMC-RI Hospital - Dialysis Unit",
      address: "KMC-RI Medical Campus, Nephrology Wing",
      distance: "On Campus",
      hasDialysis: true,
      phone: "Contact Hotline"
    },
    {
      name: "KMC-RI Urgent Care Center",
      address: "KMC-RI Medical Campus, Outpatient Building",
      distance: "On Campus",
      hasDialysis: false,
      phone: "Contact Hotline"
    },
  ];

  const priorityColors = {
    critical: "bg-red-100 border-red-300 text-red-800",
    urgent: "bg-orange-100 border-orange-300 text-orange-800",
    support: "bg-blue-100 border-blue-300 text-blue-800"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Emergency Support Hub</h1>
        </div>
        <p className="text-red-100">
          Quick access to emergency contacts and critical support resources
        </p>
      </div>

      {/* Critical Alert */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-red-900 mb-2">Medical Emergency?</h2>
            <p className="text-red-800 mb-4">
              If you are experiencing a life-threatening emergency, call 911 immediately or go to your nearest emergency room.
            </p>
            <a 
              href="tel:911"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              <Phone className="w-5 h-5" />
              Call 911 Now
            </a>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Emergency Contact Numbers</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emergencyContacts.map((contact) => {
            const Icon = contact.icon;
            return (
              <div 
                key={contact.name} 
                className={`border-2 rounded-lg p-6 ${priorityColors[contact.priority]}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-white rounded-lg">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{contact.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">{contact.available}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm mb-4">{contact.description}</p>

                <a
                  href={`tel:${contact.number}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-opacity-80 transition-colors font-bold text-lg"
                >
                  <Phone className="w-5 h-5" />
                  {contact.number}
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warning Signs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">When to Seek Emergency Care</h2>
          </div>

          <p className="text-gray-700 mb-4">
            Call 911 or go to the emergency room immediately if you experience:
          </p>

          <ul className="space-y-2">
            {emergencySigns.map((sign, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-gray-700">{sign}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">Important:</span> If you are unsure whether your symptoms 
              require emergency care, call the KMC-RI Hospital Emergency Line for guidance.
            </p>
          </div>
        </div>

        {/* Nearest Facilities */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Hospital className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Nearest Emergency Facilities</h2>
          </div>

          <div className="space-y-4">
            {nearestFacilities.map((facility) => (
              <div key={facility.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{facility.name}</h3>
                    {facility.hasDialysis && (
                      <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Dialysis Available
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">{facility.distance}</span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{facility.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <a href={`tel:${facility.phone}`} className="hover:text-blue-600">
                      {facility.phone}
                    </a>
                  </div>
                </div>

                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Get Directions
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Emergency Preparedness</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-300 rounded-lg hover:border-blue-500 transition-colors text-left">
            <FileText className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Emergency Care Plan</h3>
            <p className="text-sm text-gray-600">Download your personalized emergency plan</p>
          </button>

          <button className="p-4 border border-gray-300 rounded-lg hover:border-blue-500 transition-colors text-left">
            <FileText className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Medical Information Card</h3>
            <p className="text-sm text-gray-600">Print your emergency medical ID card</p>
          </button>

          <button className="p-4 border border-gray-300 rounded-lg hover:border-blue-500 transition-colors text-left">
            <FileText className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Medication List</h3>
            <p className="text-sm text-gray-600">View and print your current medications</p>
          </button>
        </div>
      </div>
    </div>
  );
}